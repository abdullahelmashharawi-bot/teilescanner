// Texterkennung im Hintergrund (läuft komplett auf dem Handy, ohne Internet)
let api = null, Mod = null, ready = null;

function simdSupported() {
  try {
    return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]));
  } catch (e) { return false; }
}

async function init() {
  importScripts(simdSupported() ? 'tesseract-core-simd-lstm.wasm.js' : 'tesseract-core-lstm.wasm.js');
  Mod = await TesseractCore();
  importScripts('eng-data.js'); // Sprachdaten (eingebettet)
  const bin = atob(self.ENG_TRAINEDDATA); const data = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);
  self.ENG_TRAINEDDATA = null;
  Mod.FS.writeFile('/eng.traineddata', data);
  api = new Mod.TessBaseAPI();
  if (api.Init(null, 'eng', 1) !== 0) throw new Error('OCR-Start fehlgeschlagen');
  api.SetVariable('tessedit_pageseg_mode', '11'); // verstreuter Text, passt zu Etiketten
}

self.onmessage = async (ev) => {
  const { id, bytes, psm } = ev.data;
  try {
    if (!ready) ready = init();
    await ready;
    if (!bytes) { self.postMessage({ id, ready: true }); return; }
    Mod.FS.writeFile('/input', new Uint8Array(bytes));
    api.SetVariable('tessedit_pageseg_mode', psm || '11');
    api.SetImageFile(1, 0);
    const text = api.GetUTF8Text();
    self.postMessage({ id, text });
  } catch (e) {
    ready = null;
    self.postMessage({ id, error: String((e && e.message) || e) });
  }
};
