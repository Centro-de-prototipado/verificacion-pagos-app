
import { readFileSync } from "fs";
import { extractText } from "unpdf";

async function debug() {
  const contractPath = "D:\\Documents\\verificacion-pagos-app\\lib\\docs-test\\OSE-14-4013-2026Sol401788.pdf";
  const contractBuffer = readFileSync(contractPath);
  const { text: contractText } = await extractText(new Uint8Array(contractBuffer), { mergePages: false });
  console.log(contractText.join("\n\n"));
}

debug();
