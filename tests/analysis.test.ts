import { describe, expect, it } from 'vitest'
import { defaults, iterations, maskCost, maskProjects, maskValue, portfolioMetrics, projects, simulate } from '../src/model'
import { parseProjectCsv, templateCsv } from '../src/data'

describe('decision analysis', () => {
  it('reproduces the same ensemble and respects the budget in every scenario', () => {
    const first=simulate(defaults), second=simulate(defaults)
    expect(first.optimalMasks).toEqual(second.optimalMasks)
    expect(first.scenarioScores).toEqual(second.scenarioScores)
    expect(first.optimalMasks).toHaveLength(iterations)
    expect(maskCost(first.nominalMask)).toBeLessThanOrEqual(defaults.budget+1e-8)
    expect(maskCost(first.robustMask)).toBeLessThanOrEqual(defaults.budget+1e-8)
    for(const mask of first.optimalMasks)expect(maskCost(mask)).toBeLessThanOrEqual(defaults.budget+1e-8)
  })

  it('has zero regret and one stable plan when all downstream bands are zero', () => {
    const run=simulate({...defaults,treatmentSpread:0,ecologySpread:0,deliverySpread:0})
    const metrics=portfolioMetrics(run,run.nominalMask)
    expect(metrics.stability).toBe(1)
    expect(metrics.meanRegret).toBeCloseTo(0)
    expect(Object.values(run.factorSwitch)).toEqual([0,0,0])
  })

  it('gives a reproducible decision boundary in the sample', () => {
    const run=simulate(defaults)
    expect(portfolioMetrics(run,run.nominalMask).stability).toBeGreaterThan(.1)
    expect(portfolioMetrics(run,run.nominalMask).stability).toBeLessThan(.8)
    expect(run.factorSwitch.ecology).toBeGreaterThan(0)
    expect(run.robustMask).not.toBe(run.nominalMask)
    expect(maskProjects(run.robustMask).map(p=>p.id)).not.toEqual(maskProjects(run.nominalMask).map(p=>p.id))
  })

  it('reports nonnegative regret against each scenario optimum', () => {
    const run=simulate(defaults)
    for(let i=0;i<iterations;i++){
      expect(maskValue(run.optimalMasks[i],run.scenarioScores[i]) - maskValue(run.nominalMask,run.scenarioScores[i])).toBeGreaterThanOrEqual(-1e-9)
    }
  })
})

describe('unit CSV import', () => {
  it('round trips the sample template including numeric values', () => {
    const parsed=parseProjectCsv(templateCsv())
    expect(parsed).toHaveLength(7)
    expect(parsed.map(p=>p.name)).toEqual(projects.map(p=>p.name))
    expect(parsed[0].hazard).toBe(projects[0].hazard)
    expect(simulate(defaults,parsed).nominalMask).toBe(simulate(defaults).nominalMask)
  })

  it('rejects malformed values and duplicate ids with a useful error', () => {
    expect(()=>parseProjectCsv(templateCsv().replace('"0.91"','"2"'))).toThrow(/hazard must be between 0 and 1/)
    expect(()=>parseProjectCsv(templateCsv().replace('"B","Cedar Gap"','"A","Cedar Gap"'))).toThrow(/Duplicate unit ID: A/)
  })
})
