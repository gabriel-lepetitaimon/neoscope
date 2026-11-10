export interface ImageStr {
  height: number;
  width: number;
  data: string;
}

export function parseImageString(imageString: string | DataView | ImageStr): ImageStr {
  if (typeof imageString === "object" && "height" in imageString && "width" in imageString && "data" in imageString) {
    return imageString as ImageStr;
  } else if (imageString instanceof DataView) {
    const decoder = new TextDecoder();
    imageString = decoder.decode(imageString);
  } else if (typeof imageString !== "string") {
    console.error("Invalid imageString type:", typeof imageString, imageString);
    throw new Error("Invalid imageString type. Expected string or DataView.");
  }
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
