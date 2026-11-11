import * as d3 from "d3";

export function linearChromaticScale(colorStops: { [key: number]: string }) {
  // 1. Sort entries by stop value ascending to ensure monotonic mapping
  const sortedEntries = Object.entries(colorStops)
    .map(([stop, color]) => [Number(stop), color] as [number, string])
    .sort((a, b) => a[0] - b[0]);

  if (sortedEntries.length < 2) {
    throw new Error("linearChromaticScale requires at least two color stops.");
  }

  const stops = sortedEntries.map(([stop]) => stop);
  const colors = sortedEntries.map(([, color]) => color);

  // 2. Normalize custom stops to a [0, 1] range relative to the min/max stops
  const minStop = stops[0];
  const maxStop = stops[stops.length - 1];
  const stopSpan = maxStop - minStop || 1;
  const normalizedStops = stops.map((s) => (s - minStop) / stopSpan);

  // 3. Create the uniform B-spline interpolator and piecewise stop mapper
  const basisInterpolator = d3.interpolateRgbBasis(colors);
  const uniformPositions = colors.map((_, i) => i / (colors.length - 1));

  const stopMapper = d3.scaleLinear<number, number>().domain(normalizedStops).range(uniformPositions).clamp(true);

  // 4. Return the sequential scale mapped to your target domain
  return d3.scaleSequential((t: number) => basisInterpolator(stopMapper(t)));
}
