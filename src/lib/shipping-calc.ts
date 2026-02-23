export interface AirShippingInput {
  lengthIn: number;
  widthIn: number;
  heightIn: number;
  weightLb: number;
  weightOz?: number;
  courierRatePerLb: number;
  pricePerLb: number;
  extras: number;
}

export interface AirShippingResult {
  realWeightLb: number;
  volumetricWeight: number;
  chargeableWeight: number;
  realShippingCost: number;
  clientShippingPrice: number;
  shippingProfit: number;
}

export function calcAirShipping(input: AirShippingInput): AirShippingResult {
  let realWeightLb = input.weightLb;
  if (input.weightOz) {
    realWeightLb = input.weightOz / 16;
  }

  const volumetricWeight = (input.lengthIn * input.widthIn * input.heightIn) / 166;
  const chargeableWeight = Math.ceil(Math.max(realWeightLb, volumetricWeight));
  const realShippingCost = (chargeableWeight * input.courierRatePerLb) + input.extras;
  const clientShippingPrice = chargeableWeight * input.pricePerLb;
  const shippingProfit = clientShippingPrice - realShippingCost;

  return { realWeightLb, volumetricWeight, chargeableWeight, realShippingCost, clientShippingPrice, shippingProfit };
}

export interface SeaShippingInput {
  lengthIn: number;
  widthIn: number;
  heightIn: number;
  ratePerFt3: number;
  minimum: number;
  insurance: number;
  desiredProfit: number;
}

export interface SeaShippingResult {
  volumeFt3: number;
  baseCost: number;
  realCost: number;
  realCostTotal: number;
  clientPrice: number;
}

export function calcSeaShipping(input: SeaShippingInput): SeaShippingResult {
  const volumeFt3 = (input.lengthIn * input.widthIn * input.heightIn) / 1728;
  const baseCost = volumeFt3 * input.ratePerFt3;
  const realCost = baseCost < input.minimum ? input.minimum : baseCost;
  const realCostTotal = realCost + input.insurance;
  const clientPrice = realCostTotal + input.desiredProfit;

  return { volumeFt3, baseCost, realCost, realCostTotal, clientPrice };
}

export interface UnitDistributionInput {
  totalRealShippingCost: number;
  shippingPercentForMerch: number;
  totalSellableUnits: number;
  productUnitCost: number;
  marginPercent: number;
}

export interface UnitDistributionResult {
  shippingForMerch: number;
  shippingPerUnit: number;
  realUnitCost: number;
  suggestedPrice: number;
  unitProfit: number;
  totalEstimatedProfit: number;
}

export function calcUnitDistribution(input: UnitDistributionInput): UnitDistributionResult {
  const shippingForMerch = input.totalRealShippingCost * input.shippingPercentForMerch;
  const shippingPerUnit = shippingForMerch / input.totalSellableUnits;
  const realUnitCost = input.productUnitCost + shippingPerUnit;
  const suggestedPrice = realUnitCost * (1 + input.marginPercent);
  const unitProfit = suggestedPrice - realUnitCost;
  const totalEstimatedProfit = unitProfit * input.totalSellableUnits;

  return { shippingForMerch, shippingPerUnit, realUnitCost, suggestedPrice, unitProfit, totalEstimatedProfit };
}
