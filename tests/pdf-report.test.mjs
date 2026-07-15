import assert from "node:assert/strict";
import test from "node:test";
import { safeLocalPdfFilename, togglePdfOption } from "../src/pdf-report.js";
import { readFile } from "node:fs/promises";

test("PDF filenames are cache-safe and options toggle immutably",()=>{assert.equal(safeLocalPdfFilename("North Ridge / Report"),"North-Ridge-Report.pdf");assert.equal(safeLocalPdfFilename("safe.pdf"),"safe.pdf");const source={includeFieldNotes:false};const next=togglePdfOption(source,"includeFieldNotes");assert.equal(source.includeFieldNotes,false);assert.equal(next.includeFieldNotes,true);assert.throws(()=>togglePdfOption(source,"livePositions"),/Unknown PDF option/);});
test("Android downloads only after authorization, invokes native share, and deletes temporary cache",async()=>{const source=await readFile(new URL("../src/PdfReportPanel.tsx",import.meta.url),"utf8");assert.match(source,/fetchPdfReportDownload/);assert.match(source,/FileSystem\.cacheDirectory/);assert.match(source,/Sharing\.shareAsync/);assert.match(source,/FileSystem\.deleteAsync/);assert.doesNotMatch(source,/SecureStore|documentDirectory/);});
