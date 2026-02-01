import{_ as s,o as n,c as e,ag as i}from"./chunks/framework.gFULg22W.js";const u=JSON.parse('{"title":"Markdown Documents","description":"","frontmatter":{},"headers":[],"relativePath":"guide/markdown.md","filePath":"guide/markdown.md"}'),t={name:"guide/markdown.md"};function l(o,a,p,r,d,h){return n(),e("div",null,[...a[0]||(a[0]=[i(`<h1 id="markdown-documents" tabindex="-1">Markdown Documents <a class="header-anchor" href="#markdown-documents" aria-label="Permalink to &quot;Markdown Documents&quot;">​</a></h1><p>Apiary includes a Markdown editor with live preview, perfect for documentation, notes, and README files.</p><h2 id="creating-a-markdown-request" tabindex="-1">Creating a Markdown Request <a class="header-anchor" href="#creating-a-markdown-request" aria-label="Permalink to &quot;Creating a Markdown Request&quot;">​</a></h2><ol><li>Click <strong>File → New Request</strong> and select <strong>Markdown</strong></li><li>Write Markdown content in the editor</li><li>View live preview in the right panel</li></ol><h2 id="editor-features" tabindex="-1">Editor Features <a class="header-anchor" href="#editor-features" aria-label="Permalink to &quot;Editor Features&quot;">​</a></h2><h3 id="syntax-highlighting" tabindex="-1">Syntax Highlighting <a class="header-anchor" href="#syntax-highlighting" aria-label="Permalink to &quot;Syntax Highlighting&quot;">​</a></h3><p>Markdown syntax is highlighted with different colors for headings, lists, code blocks, etc.</p><h3 id="auto-completion" tabindex="-1">Auto-completion <a class="header-anchor" href="#auto-completion" aria-label="Permalink to &quot;Auto-completion&quot;">​</a></h3><ul><li><strong>Headings</strong>: Auto-complete <code>#</code> with space</li><li><strong>Lists</strong>: Auto-indent and continue numbering</li><li><strong>Links</strong>: Suggest link formatting</li><li><strong>Images</strong>: Suggest image syntax</li></ul><h3 id="toolbar" tabindex="-1">Toolbar <a class="header-anchor" href="#toolbar" aria-label="Permalink to &quot;Toolbar&quot;">​</a></h3><p>Formatting toolbar for common operations:</p><ul><li><strong>Bold</strong>, <em>Italic</em>, <code>Code</code></li><li>Headings H1-H6</li><li>Lists (ordered and unordered)</li><li>Links and images</li><li>Tables</li></ul><h3 id="multiple-cursors" tabindex="-1">Multiple Cursors <a class="header-anchor" href="#multiple-cursors" aria-label="Permalink to &quot;Multiple Cursors&quot;">​</a></h3><p>Use multiple cursors for editing similar elements simultaneously.</p><h2 id="preview-pane" tabindex="-1">Preview Pane <a class="header-anchor" href="#preview-pane" aria-label="Permalink to &quot;Preview Pane&quot;">​</a></h2><h3 id="live-rendering" tabindex="-1">Live Rendering <a class="header-anchor" href="#live-rendering" aria-label="Permalink to &quot;Live Rendering&quot;">​</a></h3><p>Markdown is rendered as HTML in real-time as you type.</p><h3 id="theme-support" tabindex="-1">Theme Support <a class="header-anchor" href="#theme-support" aria-label="Permalink to &quot;Theme Support&quot;">​</a></h3><p>Preview supports light and dark themes matching the editor theme.</p><h3 id="scroll-sync" tabindex="-1">Scroll Sync <a class="header-anchor" href="#scroll-sync" aria-label="Permalink to &quot;Scroll Sync&quot;">​</a></h3><p>Editor and preview scroll positions are synchronized.</p><h3 id="export-options" tabindex="-1">Export Options <a class="header-anchor" href="#export-options" aria-label="Permalink to &quot;Export Options&quot;">​</a></h3><p>Export the rendered document as:</p><ul><li><strong>HTML</strong>: Full HTML document with CSS</li><li><strong>PDF</strong>: Print to PDF</li><li><strong>Markdown</strong>: Raw markdown file</li></ul><h2 id="advanced-features" tabindex="-1">Advanced Features <a class="header-anchor" href="#advanced-features" aria-label="Permalink to &quot;Advanced Features&quot;">​</a></h2><h3 id="custom-css" tabindex="-1">Custom CSS <a class="header-anchor" href="#custom-css" aria-label="Permalink to &quot;Custom CSS&quot;">​</a></h3><p>Add custom CSS to style the preview pane differently.</p><h3 id="diagram-support" tabindex="-1">Diagram Support <a class="header-anchor" href="#diagram-support" aria-label="Permalink to &quot;Diagram Support&quot;">​</a></h3><p>Render Mermaid, PlantUML, and Kroki diagrams within markdown.</p><h3 id="mathjax" tabindex="-1">MathJax <a class="header-anchor" href="#mathjax" aria-label="Permalink to &quot;MathJax&quot;">​</a></h3><p>Render mathematical equations using LaTeX syntax with MathJax.</p><h3 id="table-of-contents" tabindex="-1">Table of Contents <a class="header-anchor" href="#table-of-contents" aria-label="Permalink to &quot;Table of Contents&quot;">​</a></h3><p>Auto-generate table of contents from headings.</p><h2 id="example-basic-document" tabindex="-1">Example: Basic Document <a class="header-anchor" href="#example-basic-document" aria-label="Permalink to &quot;Example: Basic Document&quot;">​</a></h2><div class="language-markdown vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">markdown</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#005CC5;--shiki-light-font-weight:bold;--shiki-dark:#79B8FF;--shiki-dark-font-weight:bold;"># Project Documentation</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-light-font-weight:bold;--shiki-dark:#79B8FF;--shiki-dark-font-weight:bold;">## Introduction</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">This is a sample document created in Apiary.</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-light-font-weight:bold;--shiki-dark:#79B8FF;--shiki-dark-font-weight:bold;">## Features</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#E36209;--shiki-dark:#FFAB70;">-</span><span style="--shiki-light:#24292E;--shiki-light-font-weight:bold;--shiki-dark:#E1E4E8;--shiki-dark-font-weight:bold;"> **Live Preview**</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: See changes as you type</span></span>
<span class="line"><span style="--shiki-light:#E36209;--shiki-dark:#FFAB70;">-</span><span style="--shiki-light:#24292E;--shiki-light-font-weight:bold;--shiki-dark:#E1E4E8;--shiki-dark-font-weight:bold;"> **Export Options**</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: Save as HTML, PDF, or Markdown</span></span>
<span class="line"><span style="--shiki-light:#E36209;--shiki-dark:#FFAB70;">-</span><span style="--shiki-light:#24292E;--shiki-light-font-weight:bold;--shiki-dark:#E1E4E8;--shiki-dark-font-weight:bold;"> **Syntax Highlighting**</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: Code blocks with language support</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-light-font-weight:bold;--shiki-dark:#79B8FF;--shiki-dark-font-weight:bold;">## Code Example</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">\`\`\`python</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">def hello():</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    print(&quot;Hello from Apiary!&quot;)</span></span></code></pre></div><h2 id="table" tabindex="-1">Table <a class="header-anchor" href="#table" aria-label="Permalink to &quot;Table&quot;">​</a></h2><table tabindex="0"><thead><tr><th>Feature</th><th>Status</th></tr></thead><tbody><tr><td>Live Preview</td><td>✅</td></tr><tr><td>Export</td><td>✅</td></tr><tr><td>Diagrams</td><td>⏳</td></tr></tbody></table><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span></span></span>
<span class="line"><span>## Integration with Files</span></span>
<span class="line"><span></span></span>
<span class="line"><span>### Open Local Files</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Open existing \`.md\` files from your filesystem.</span></span>
<span class="line"><span></span></span>
<span class="line"><span>### Save to File</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Save markdown documents to your local filesystem.</span></span>
<span class="line"><span></span></span>
<span class="line"><span>### Auto-save</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Documents are auto-saved to Apiary&#39;s database.</span></span>
<span class="line"><span></span></span>
<span class="line"><span>## Use Cases</span></span>
<span class="line"><span></span></span>
<span class="line"><span>### Documentation</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Write API documentation, user guides, and technical specs.</span></span>
<span class="line"><span></span></span>
<span class="line"><span>### Notes</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Take meeting notes, brainstorming sessions, and todo lists.</span></span>
<span class="line"><span></span></span>
<span class="line"><span>### README Files</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Create README files for your projects with live preview.</span></span>
<span class="line"><span></span></span>
<span class="line"><span>### Blog Posts</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Draft blog posts with proper formatting and preview.</span></span>
<span class="line"><span></span></span>
<span class="line"><span>## Next Steps</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Explore other request types like [HTTP](/guide/http) and [JQ](/guide/jq).</span></span></code></pre></div>`,38)])])}const g=s(t,[["render",l]]);export{u as __pageData,g as default};
