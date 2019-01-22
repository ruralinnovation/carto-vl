import { validateStaticType, validateTypeErrors, validateMaxArgumentsError, validateMinArgumentsError, validateExactNumArgumentsError } from '../utils';
import { average, standardDeviation } from '../../../../../../src/renderer/viz/expressions/stats';
import { property, globalQuantiles, globalEqIntervals, globalStandardDev, viewportQuantiles, viewportEqIntervals, viewportStandardDev } from '../../../../../../src/renderer/viz/expressions';

import Metadata from '../../../../../../src/renderer/Metadata';
import { DEFAULT_HISTOGRAM_SIZE } from '../../../../../../src/renderer/viz/expressions/classification/Classifier';

describe('src/renderer/viz/expressions/classifier', () => {
    describe('error control', () => {
        describe('global', () => {
            validateExactNumArgumentsError('globalQuantiles', []);
            validateTypeErrors('globalQuantiles', ['number', 'category']);
            validateTypeErrors('globalQuantiles', ['category', 2]);
            validateTypeErrors('globalQuantiles', ['color', 2]);
            validateTypeErrors('globalQuantiles', ['number', 'color']);
            validateExactNumArgumentsError('globalQuantiles', ['number', 'number-array', 'number']);

            validateExactNumArgumentsError('globalEqIntervals', []);
            validateTypeErrors('globalEqIntervals', ['number', 'category']);
            validateTypeErrors('globalEqIntervals', ['category', 2]);
            validateTypeErrors('globalEqIntervals', ['color', 2]);
            validateTypeErrors('globalEqIntervals', ['number', 'color']);
            validateExactNumArgumentsError('globalEqIntervals', ['number', 'number-array', 'number']);

            validateMinArgumentsError('globalStandardDev', []);
            validateTypeErrors('globalStandardDev', ['number', 'category']);
            validateTypeErrors('globalStandardDev', ['category', 2]);
            validateTypeErrors('globalStandardDev', ['color', 2]);
            validateTypeErrors('globalStandardDev', ['number', 'color']);
            validateMaxArgumentsError('globalStandardDev', ['number', 'number-array', 'number', 'number']);
        });

        describe('viewport', () => {
            validateMinArgumentsError('viewportQuantiles', []);
            validateTypeErrors('viewportQuantiles', ['number', 'category']);
            validateTypeErrors('viewportQuantiles', ['category', 2]);
            validateTypeErrors('viewportQuantiles', ['color', 2]);
            validateTypeErrors('viewportQuantiles', ['number', 'color']);
            validateMaxArgumentsError('viewportQuantiles', ['number', 'number-array', 'number', 'number']);

            validateExactNumArgumentsError('viewportEqIntervals', []);
            validateTypeErrors('viewportEqIntervals', ['number', 'category']);
            validateTypeErrors('viewportEqIntervals', ['category', 2]);
            validateTypeErrors('viewportEqIntervals', ['color', 2]);
            validateTypeErrors('viewportEqIntervals', ['number', 'color']);
            validateExactNumArgumentsError('viewportEqIntervals', ['number', 'number-array', 'number']);

            validateTypeErrors('viewportStandardDev', []);
            validateTypeErrors('viewportStandardDev', ['number', 'category']);
            validateTypeErrors('viewportStandardDev', ['category', 2]);
            validateTypeErrors('viewportStandardDev', ['color', 2]);
            validateTypeErrors('viewportStandardDev', ['number', 'color']);
            validateMaxArgumentsError('viewportStandardDev', ['number', 'number-array', 'number', 'number', 'number']);

            validateTypeErrors('viewportPercentile', []);
            validateTypeErrors('viewportPercentile', ['number', 'category']);
            validateTypeErrors('viewportPercentile', ['category', 2]);
            validateTypeErrors('viewportPercentile', ['color', 2]);
            validateTypeErrors('viewportPercentile', ['number', 'color']);
            validateMaxArgumentsError('viewportPercentile', ['number', 'number', 'number']);
        });
    });

    describe('type', () => {
        validateStaticType('viewportQuantiles', ['number-property', 2, 100], 'category');
        validateStaticType('viewportStandardDev', ['number-property', 2, 0.5, 100], 'category');
        validateStaticType('viewportPercentile', ['number', 'number'], 'number');
    });

    describe('eval', () => {
        const $price = property('price');
        const METADATA = new Metadata({
            properties: {
                price: {
                    type: 'number',
                    min: 0,
                    max: 5
                }
            },
            sample: [
                { price: 0 },
                { price: 1 },
                { price: 2 },
                { price: 3 },
                { price: 4 },
                { price: 5 }
            ]
        });

        function sampleValues () {
            return METADATA.sample.map(s => s.price);
        }

        function prepare (expr) {
            expr._resolveAliases();
            expr._bindMetadata(METADATA);
            expr._resetViewportAgg(METADATA);
            expr.accumViewportAgg({
                price: 0
            });
            expr.accumViewportAgg({
                price: 1
            });

            expr.accumViewportAgg({
                price: 2
            });
            expr.accumViewportAgg({
                price: 3
            });

            expr.accumViewportAgg({
                price: 4
            });
            expr.accumViewportAgg({
                price: 5
            });
        }

        describe('global', () => {
            describe('.globalQuantiles', () => {
                it('globalQuantiles($price, 2)', () => {
                    const q = globalQuantiles($price, 2);
                    prepare(q);
                    expect(q.getBreakpointList()).toEqual([3]);
                });
                it('globalQuantiles($price, 3)', () => {
                    const q = globalQuantiles($price, 3);
                    prepare(q);
                    expect(q.getBreakpointList()).toEqual([2, 4]);
                });
            });

            describe('.globalEqIntervals', () => {
                it('globalEqIntervals($price, 2)', () => {
                    const q = globalEqIntervals($price, 2);
                    prepare(q);
                    expect(q.getBreakpointList()).toEqual([2.5]);
                });
            });

            describe('.globalStandardDev', () => {
                const avg = average(sampleValues());
                const std = standardDeviation(sampleValues());

                it('globalStandardDev($price, 2)', () => {
                    const q = globalStandardDev($price, 2);
                    prepare(q);
                    expect(q.getBreakpointList()).toEqual([avg]);
                });

                it('globalStandardDev($price, 3)', () => {
                    const q = globalStandardDev($price, 3);
                    prepare(q);
                    expect(q.getBreakpointList()).toEqual([avg - std, avg + std]);
                });

                it('globalStandardDev($price, 4)', () => {
                    const q = globalStandardDev($price, 4);
                    prepare(q);
                    expect(q.getBreakpointList()).toEqual([avg - std, avg, avg + std]);
                });

                it('globalStandardDev($price, 5)', () => {
                    const q = globalStandardDev($price, 5);
                    prepare(q);
                    expect(q.getBreakpointList()).toEqual([
                        avg - (2 * std), avg - std, avg + std, avg + (2 * std)
                    ]);
                });

                it('globalStandardDev($price, 3, 0.5) --> using 1/2 standard deviation', () => {
                    const q = globalStandardDev($price, 3, 0.5);
                    prepare(q);
                    expect(q.getBreakpointList()).toEqual([avg - 0.5 * std, avg + 0.5 * std]);
                });

                it('doesn\'t allow an invalid classSize (<=0)', () => {
                    expect(() => {
                        const q = globalStandardDev($price, 3, 0.0);
                        prepare(q);
                    }).toThrow();

                    expect(() => {
                        const q = globalStandardDev($price, 3, -1.0);
                        prepare(q);
                    }).toThrow();
                });

                it('doesn\'t allow an invalid number of buckets (<=2)', () => {
                    expect(() => {
                        const q = globalStandardDev($price, 0);
                        prepare(q);
                    }).toThrow();

                    expect(() => {
                        const q = globalStandardDev($price, 1);
                        prepare(q);
                    }).toThrow();
                });
            });
        });

        describe('viewport', () => {
            describe('.viewportQuantiles', () => {
                it('viewportQuantiles($price, 2)', () => {
                    const q = viewportQuantiles($price, 2);
                    prepare(q);
                    expect(q.getBreakpointList()).toEqual([3]);
                });
                it('viewportQuantiles($price, 3)', () => {
                    const q = viewportQuantiles($price, 3);
                    prepare(q);
                    expect(q.getBreakpointList()).toEqual([2, 4]);
                    expect(q._histogram._sizeOrBuckets).toEqual(DEFAULT_HISTOGRAM_SIZE);
                });
                it('viewportQuantiles($price, 3, 30)', () => {
                    const q = viewportQuantiles($price, 3, 30);
                    prepare(q);
                    expect(q.getBreakpointList()).toEqual([2, 4]);
                    expect(q._histogram._sizeOrBuckets).toEqual(30);
                });
            });

            describe('.viewportEqIntervals', () => {
                it('viewportEqIntervals($price, 2)', () => {
                    const q = viewportEqIntervals($price, 2);
                    prepare(q);
                    expect(q.getBreakpointList()).toEqual([2.5]);
                });
                it('viewportEqIntervals($price, 3)', () => {
                    const q = viewportEqIntervals($price, 3);
                    prepare(q);
                    expect(q.getBreakpointList()[0]).toBeCloseTo(5 / 3, 4);
                    expect(q.getBreakpointList()[1]).toBeCloseTo(10 / 3, 4);
                });
            });

            describe('.viewportStandardDev', () => {
                const avg = average(sampleValues());
                const std = standardDeviation(sampleValues());

                it('viewportStandardDev($price, 2)', () => {
                    const q = viewportStandardDev($price, 2);
                    prepare(q);
                    expect(q.getBreakpointList()).toBeCloseTo([avg], 2);
                });

                it('viewportStandardDev($price, 3)', () => {
                    const q = viewportStandardDev($price, 3);
                    prepare(q);
                    expect(q.getBreakpointList()[0]).toBeCloseTo(avg - std, 2);
                    expect(q.getBreakpointList()[1]).toBeCloseTo(avg + std, 2);

                    expect(q._histogram._sizeOrBuckets).toEqual(DEFAULT_HISTOGRAM_SIZE);
                });

                it('viewportStandardDev($price, 4)', () => {
                    const q = viewportStandardDev($price, 4);
                    prepare(q);
                    expect(q.getBreakpointList()[0]).toBeCloseTo(avg - std, 2);
                    expect(q.getBreakpointList()[1]).toBeCloseTo(avg, 2);
                    expect(q.getBreakpointList()[2]).toBeCloseTo(avg + std, 2);
                });

                it('viewportStandardDev($price, 5)', () => {
                    const q = viewportStandardDev($price, 5);
                    prepare(q);
                    expect(q.getBreakpointList()[0]).toBeCloseTo(avg - (2 * std), 2);
                    expect(q.getBreakpointList()[1]).toBeCloseTo(avg - std, 2);
                    expect(q.getBreakpointList()[2]).toBeCloseTo(avg + std, 2);
                    expect(q.getBreakpointList()[3]).toBeCloseTo(avg + (2 * std), 2);
                });

                it('viewportStandardDev($price, 3, 0.5) --> using 1/2 standard deviation', () => {
                    const q = viewportStandardDev($price, 3, 0.5);
                    prepare(q);
                    expect(q.getBreakpointList()[0]).toBeCloseTo(avg - 0.5 * std, 2);
                    expect(q.getBreakpointList()[1]).toBeCloseTo(avg + 0.5 * std, 2);
                });

                describe('.histogramSize influence...', () => {
                    it('viewportStandardDev($price, 3, 1, 2000) --> 2000 is precise...', () => {
                        const q = viewportStandardDev($price, 3, 1, 2000);
                        prepare(q);
                        expect(q._histogram._sizeOrBuckets).toEqual(2000);

                        expect(q.getBreakpointList()[0]).toBeCloseTo(avg - std, 2);
                        expect(q.getBreakpointList()[1]).toBeCloseTo(avg + std, 2);
                    });
                    it('viewportStandardDev($price, 3, 1, 30) --> 30 is not!...', () => {
                        const q = viewportStandardDev($price, 3, 1, 30);
                        prepare(q);
                        expect(q._histogram._sizeOrBuckets).toEqual(30);

                        expect(q.getBreakpointList()[0]).toBeCloseTo(avg - std, 0); // vs (avg - std, 2);
                        expect(q.getBreakpointList()[1]).toBeCloseTo(avg + std, 0); // vs (avg + std, 2);
                    });
                });

                it('doesn\'t allow an invalid classSize (<=0)', () => {
                    expect(() => viewportStandardDev($price, 3, 0.0)).toThrow();
                    expect(() => viewportStandardDev($price, 3, -1.0)).toThrow();
                });

                it('doesn\'t allow an invalid number of buckets (<=2)', () => {
                    expect(() => viewportStandardDev($price, 0)).toThrow();
                    expect(() => viewportStandardDev($price, 1)).toThrow();
                });
            });
        });
    });
});
