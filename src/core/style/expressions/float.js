import Expression from './expression';


export default class Float extends Expression {
    /**
     * @jsapi
     * @param {*} x
     */
    constructor(x) {
        if (!Number.isFinite(x)) {
            throw new Error(`Invalid arguments to Float(): ${x}`);
        }
        super({});
        this.expr = x;
    }
    _compile() {
        this.type = 'float';
    }
    _applyToShaderSource(uniformIDMaker) {
        this._uniformID = uniformIDMaker();
        return {
            preface: `uniform float float${this._uniformID};\n`,
            inline: `float${this._uniformID}`
        };
    }
    _postShaderCompile(program, gl) {
        this._uniformLocation = gl.getUniformLocation(program, `float${this._uniformID}`);
    }
    _preDraw(l, gl) {
        gl.uniform1f(this._uniformLocation, this.expr);
    }
    isAnimated() {
        return false;
    }
}