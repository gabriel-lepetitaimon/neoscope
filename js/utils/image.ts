export function parseImageString(imageString: string): { height: number; width: number; data: string } {
  const headerIndex = imageString.indexOf("|");
  const header = imageString.slice(0, headerIndex);
  const [height, width, ext] = header.split(",").map((s) => (isNaN(Number(s)) ? s : Number(s))) as [
    number,
    number,
    string,
  ];
  const data = `data:image/${ext};base64,` + imageString.slice(headerIndex + 1);
  return { height, width, data };
}
