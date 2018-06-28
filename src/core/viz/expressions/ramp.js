import BaseExpression from './base';
import { implicitCast, checkLooseType, checkExpression, checkType, clamp, checkInstance } from './utils';
import { cielabToSRGB, sRGBToCielab } from '../colorspaces';
import Sprites from './sprites';

/**
* Create a ramp: a mapping between an input (a numeric or categorical expression) and an output (a color palette or a numeric palette, to create bubble maps)
*
* Categories to colors
* Categorical expressions can be used as the input for `ramp` in combination with color palettes. If the number of categories exceeds the number of available colors in the palette new colors will be generated by
* using CieLAB interpolation.
*
* Categories to numeric
* Categorical expression can be used as the input for `ramp` in combination with numeric palettes. If the number of input categories doesn't match the number of numbers in the numeric palette, linear interpolation will be used.
*
* Numeric expressions to colors
* Numeric expressions can be used as the input for `ramp` in combination with color palettes. Colors will be generated by using CieLAB interpolation.
*
* Numeric expressions to numeric
* Numeric expressions can be used as the input for `ramp` in combination with numeric palettes. Linear interpolation will be used to generate intermediate output values.
*
* @param {Number|Category} input - The input expression to give a color
* @param {Palette|Color[]|Number[]} palette - The color palette that is going to be used
* @return {Number|Color}
*
* @example <caption>Mapping categories to colors and numbers</caption>
* const s = carto.expressions;
* const viz = new carto.Viz({
*   width: s.ramp(s.buckets(s.prop('dn'), [20, 50, 120]), [1, 4, 8])
*   color: s.ramp(s.buckets(s.prop('dn'), [20, 50, 120]), s.palettes.PRISM)
* });
*
* @example <caption>Mapping categories to colors and numbers (String)</caption>
* const viz = new carto.Viz(`
*   width: ramp(buckets($dn, [20, 50, 120]), [1, 10,4])
*   color: ramp(buckets($dn, [20, 50, 120]), prism)
* `);
*
*
* @example <caption>Mapping numeric expressions to colors and numbers</caption>
* const s = carto.expressions;
* const viz = new carto.Viz({
*   width: s.ramp(s.linear(s.prop('dn'), 40, 100), [1, 8])
*   color: s.ramp(s.linear(s.prop('dn'), 40, 100), s.palettes.PRISM)
* });
*
* @example <caption>Mapping numeric expressions to colors and numbers (String)</caption>
* const viz = new carto.Viz(`
*   width: ramp(linear($dn, 40, 100), [1, 10,4])
*   color: ramp(linear($dn, 40, 100), prism)
* `);
*
* @memberof carto.expressions
* @name ramp
* @function
* @api
*/
export default class Ramp extends BaseExpression {
    constructor(input, palette) {
        input = implicitCast(input);
        palette = implicitCast(palette);

        checkExpression('ramp', 'input', 0, input);
        checkLooseType('ramp', 'input', 0, ['number', 'category'], input);
        checkLooseType('ramp', 'palette', 1, ['palette', 'color-array', 'number-array', 'sprite'], palette);
        if (palette.type == 'sprite') {
            checkInstance('ramp', 'palette', 1, Sprites, palette);
            checkLooseType('ramp', 'input', 0, 'category', input);
        }

        super({ input: input });
        this.minKey = 0;
        this.maxKey = 1;
        this.palette = palette;
        if (palette.type == 'number-array') {
            this.type = 'number';
        } else {
            this.type = 'color';
        }
        try {
            if (palette.type == 'number-array') {
                this.palette.floats = this.palette.eval();
            } else if (palette.type == 'color-array') {
                this.palette.colors = this.palette.eval();
            }
        } catch (error) {
            throw new Error('Palettes must be formed by constant expressions, they cannot depend on feature properties');
        }
    }

    loadSprites() {
        return Promise.all([this.input.loadSprites(), this.palette.loadSprites()]);
    }

    _setUID(idGenerator) {
        super._setUID(idGenerator);
        this.palette._setUID(idGenerator);
    }

    eval(o) {
        if (this.palette.type != 'number-array') {
            super.eval(o);
        }
        this._computeTextureIfNeeded();
        const input = this.input.eval(o);
        const m = (input - this.minKey) / (this.maxKey - this.minKey);
        const len = this.pixel.length - 1;
        const lowIndex = clamp(Math.floor(len * m), 0, len);
        const highIndex = clamp(Math.ceil(len * m), 0, len);
        const low = this.pixel[lowIndex];
        const high = this.pixel[highIndex];
        const fract = len * m - Math.floor(len * m);
        return fract * high + (1 - fract) * low;
    }
    _compile(meta) {
        super._compile(meta);
        checkType('ramp', 'input', 0, ['number', 'category'], this.input);
        if (this.palette.type == 'sprite') {
            checkType('ramp', 'input', 0, 'category', this.input);
            checkInstance('ramp', 'palette', 1, Sprites, this.palette);
        }
        this._texCategories = null;
        this._GLtexCategories = null;
    }

    _free(gl) {
        if (this.texture) {
            gl.deleteTexture(this.texture);
        }
    }

    _applyToShaderSource(getGLSLforProperty) {
        const input = this.input._applyToShaderSource(getGLSLforProperty);
        if (this.palette.type == 'sprite') {
            const sprites = this.palette._applyToShaderSource(getGLSLforProperty);
            return {
                preface: input.preface + sprites.preface,
                inline: `${sprites.inline}(spriteUV, ${input.inline})`
            };
        }
        return {
            preface: this._prefaceCode(input.preface + `
                uniform sampler2D texRamp${this._uid};
                uniform float keyMin${this._uid};
                uniform float keyWidth${this._uid};`
            ),
            inline: this.palette.type == 'number-array'
                ? `(texture2D(texRamp${this._uid}, vec2((${input.inline}-keyMin${this._uid})/keyWidth${this._uid}, 0.5)).a)`
                : `texture2D(texRamp${this._uid}, vec2((${input.inline}-keyMin${this._uid})/keyWidth${this._uid}, 0.5)).rgba`
        };
    }
    _getColorsFromPalette(input, palette) {
        if (palette.type == 'palette') {
            let colors;
            if (input.numCategories) {
                // If we are not gonna pop the others we don't need to get the extra color
                const subPalette = (palette.tags.includes('qualitative') && !input.othersBucket) ? input.numCategories : input.numCategories - 1;
                if (palette.subPalettes[subPalette]) {
                    colors = palette.subPalettes[subPalette];
                } else {
                    // More categories than palettes, new colors will be created by linear interpolation
                    colors = palette.getLongestSubPalette();
                }
            } else {
                colors = palette.getLongestSubPalette();
            }
            // We need to remove the 'others' color if the palette has it (it is a qualitative palette) and if the input doesn't have a 'others' bucket
            if (palette.tags.includes('qualitative') && !input.othersBucket) {
                colors = colors.slice(0, colors.length - 1);
            }
            return colors;
        } else {
            return palette.colors;
        }
    }
    _postShaderCompile(program, gl) {
        if (this.palette.type == 'sprite') {
            this.palette._postShaderCompile(program, gl);
            super._postShaderCompile(program, gl);
            return;
        }
        this.input._postShaderCompile(program, gl);
        this._getBinding(program).texLoc = gl.getUniformLocation(program, `texRamp${this._uid}`);
        this._getBinding(program).keyMinLoc = gl.getUniformLocation(program, `keyMin${this._uid}`);
        this._getBinding(program).keyWidthLoc = gl.getUniformLocation(program, `keyWidth${this._uid}`);
    }
    _computeTextureIfNeeded() {
        if (this._texCategories !== this.input.numCategories) {
            this._texCategories = this.input.numCategories;

            if (this.input.type == 'category') {
                this.maxKey = this.input.numCategories - 1;
            }
            const width = 256;
            if (this.type == 'color') {
                const pixel = new Uint8Array(4 * width);
                const colors = this._getColorsFromPalette(this.input, this.palette);
                for (let i = 0; i < width; i++) {
                    const vlowRaw = colors[Math.floor(i / (width - 1) * (colors.length - 1))];
                    const vhighRaw = colors[Math.ceil(i / (width - 1) * (colors.length - 1))];
                    const vlow = [vlowRaw.r / 255, vlowRaw.g / 255, vlowRaw.b / 255, vlowRaw.a];
                    const vhigh = [vhighRaw.r / 255, vhighRaw.g / 255, vhighRaw.b / 255, vhighRaw.a];
                    const m = i / (width - 1) * (colors.length - 1) - Math.floor(i / (width - 1) * (colors.length - 1));
                    const v = interpolate({ r: vlow[0], g: vlow[1], b: vlow[2], a: vlow[3] }, { r: vhigh[0], g: vhigh[1], b: vhigh[2], a: vhigh[3] }, m);
                    pixel[4 * i + 0] = v.r * 255;
                    pixel[4 * i + 1] = v.g * 255;
                    pixel[4 * i + 2] = v.b * 255;
                    pixel[4 * i + 3] = v.a * 255;
                }
                this.pixel = pixel;
            } else {
                const pixel = new Float32Array(width);
                const floats = this.palette.floats;
                for (let i = 0; i < width; i++) {
                    const vlowRaw = floats[Math.floor(i / (width - 1) * (floats.length - 1))];
                    const vhighRaw = floats[Math.ceil(i / (width - 1) * (floats.length - 1))];
                    const m = i / (width - 1) * (floats.length - 1) - Math.floor(i / (width - 1) * (floats.length - 1));
                    pixel[i] = ((1. - m) * vlowRaw + m * vhighRaw);
                }
                this.pixel = pixel;
            }
        }
    }
    _computeGLTextureIfNeeded(gl) {
        this._computeTextureIfNeeded();
        if (this._GLtexCategories !== this.input.numCategories) {
            this._GLtexCategories = this.input.numCategories;

            const width = 256;
            this.texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, this.texture);
            const pixel = this.pixel;
            if (this.type == 'color') {
                gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,
                    width, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
                    pixel);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            } else {
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.ALPHA,
                    width, 1, 0, gl.ALPHA, gl.FLOAT,
                    pixel);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            }

            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        }
    }
    _preDraw(program, drawMetadata, gl) {
        this.input._preDraw(program, drawMetadata, gl);
        if (this.palette.type == 'sprite') {
            this.palette._preDraw(program, drawMetadata, gl);
            return;
        }
        gl.activeTexture(gl.TEXTURE0 + drawMetadata.freeTexUnit);
        this._computeGLTextureIfNeeded(gl);
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.uniform1i(this._getBinding(program).texLoc, drawMetadata.freeTexUnit);
        gl.uniform1f(this._getBinding(program).keyMinLoc, (this.minKey));
        gl.uniform1f(this._getBinding(program).keyWidthLoc, (this.maxKey) - (this.minKey));
        drawMetadata.freeTexUnit++;
    }
}

function interpolate(low, high, m) {
    const cielabLow = sRGBToCielab({
        r: low.r,
        g: low.g,
        b: low.b,
        a: low.a,
    });
    const cielabHigh = sRGBToCielab({
        r: high.r,
        g: high.g,
        b: high.b,
        a: high.a,
    });

    const cielabInterpolated = {
        l: (1 - m) * cielabLow.l + m * cielabHigh.l,
        a: (1 - m) * cielabLow.a + m * cielabHigh.a,
        b: (1 - m) * cielabLow.b + m * cielabHigh.b,
        alpha: (1 - m) * cielabLow.alpha + m * cielabHigh.alpha,
    };

    return cielabToSRGB(cielabInterpolated);
}
