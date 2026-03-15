/**
 * Creates a minimal valid EPUB file for testing.
 * Run: npx tsx tests/fixtures/create-test-epub.ts
 */
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const dir = join(import.meta.dirname, '_epub_build');

// Clean and create build dir
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
mkdirSync(join(dir, 'META-INF'), { recursive: true });
mkdirSync(join(dir, 'OEBPS'), { recursive: true });

// mimetype (must be first file in zip, uncompressed)
writeFileSync(join(dir, 'mimetype'), 'application/epub+zip');

// META-INF/container.xml
writeFileSync(join(dir, 'META-INF', 'container.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`);

// OEBPS/content.opf
writeFileSync(join(dir, 'OEBPS', 'content.opf'), `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Test Book</dc:title>
    <dc:creator>Test Author</dc:creator>
    <dc:language>en</dc:language>
    <dc:identifier id="bookid">test-book-001</dc:identifier>
  </metadata>
  <manifest>
    <item id="ch1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch2" href="chapter2.xhtml" media-type="application/xhtml+xml"/>
    <item id="short" href="short.xhtml" media-type="application/xhtml+xml"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="short"/>
    <itemref idref="ch1"/>
    <itemref idref="ch2"/>
  </spine>
</package>`);

// OEBPS/toc.ncx (minimal)
writeFileSync(join(dir, 'OEBPS', 'toc.ncx'), `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="test-book-001"/></head>
  <docTitle><text>Test Book</text></docTitle>
  <navMap>
    <navPoint id="np1" playOrder="1"><navLabel><text>Short</text></navLabel><content src="short.xhtml"/></navPoint>
    <navPoint id="np2" playOrder="2"><navLabel><text>Chapter 1</text></navLabel><content src="chapter1.xhtml"/></navPoint>
    <navPoint id="np3" playOrder="3"><navLabel><text>Chapter 2</text></navLabel><content src="chapter2.xhtml"/></navPoint>
  </navMap>
</ncx>`);

// Short chapter (should be skipped: < 20 chars)
writeFileSync(join(dir, 'OEBPS', 'short.xhtml'), `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Short</title></head>
<body><p>Title page.</p></body>
</html>`);

// Chapter 1 with 8 sentences
writeFileSync(join(dir, 'OEBPS', 'chapter1.xhtml'), `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Chapter 1</title></head>
<body>
<h1>Chapter 1: The Beginning</h1>
<p>The morning sun cast long shadows across the quiet village. Birds sang their first songs of the day from the old oak trees. A gentle breeze carried the scent of fresh bread from the bakery down the street. Mrs. Thompson opened her shop at exactly seven o'clock, as she had done every day for thirty years.</p>
<p>The cobblestone streets were still wet from last night's rain. Children began to appear on their way to school, their laughter echoing between the buildings. The old church bell rang eight times, marking the hour. Life in the village moved at its own peaceful pace.</p>
</body>
</html>`);

// Chapter 2 with 7 sentences
writeFileSync(join(dir, 'OEBPS', 'chapter2.xhtml'), `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Chapter 2</title></head>
<body>
<h1>Chapter 2: The Journey</h1>
<p>Dr. Smith decided it was time to leave the village and explore the world beyond the mountains. He packed his leather bag with books and supplies for the long journey ahead. The road wound through dense forests and over rushing streams.</p>
<p>After three days of walking, he reached the great city of Millbrook. The buildings towered above him like ancient giants watching over the streets below. Merchants called out their wares from colorful stalls lining the main boulevard. He knew this was where his new adventure would truly begin.</p>
</body>
</html>`);

// Build EPUB using zip
const outPath = join(import.meta.dirname, 'test.epub');
// mimetype must be first, stored (not compressed)
execSync(`cd "${dir}" && zip -0 -X "${outPath}" mimetype`);
execSync(`cd "${dir}" && zip -r -X "${outPath}" META-INF OEBPS`);

// Clean up build dir
rmSync(dir, { recursive: true, force: true });

console.log(`Created: ${outPath}`);
