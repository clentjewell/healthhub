<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:s="http://www.sitemaps.org/schemas/sitemap/0.9">
  <xsl:output method="html" encoding="UTF-8" indent="yes"
    doctype-system="about:legacy-compat" />

  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex,follow" />
        <title>XML Sitemap — Health Hub Tweed Coast</title>
        <style>
          :root { --brand:#34719f; --navy:#22496c; --ink:#2a3742; --muted:#6b7b85; --line:#e2ebef; --tint:#eef6f8; }
          * { box-sizing:border-box; }
          body { margin:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color:var(--ink); background:#f4f8f9; }
          .bar { background:var(--navy); color:#fff; padding:22px 20px; }
          .bar .wrap { max-width:1000px; margin:0 auto; }
          .bar h1 { margin:0; font-size:1.35rem; }
          .bar p { margin:6px 0 0; color:#cfe0e8; font-size:.9rem; }
          .wrap { max-width:1000px; margin:0 auto; padding:20px; }
          .note { color:var(--muted); font-size:.88rem; margin:18px 0; }
          .note a { color:var(--brand); }
          .count { font-weight:600; color:var(--navy); margin:0 0 12px; }
          table { width:100%; border-collapse:collapse; background:#fff; border:1px solid var(--line); border-radius:12px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,.04); }
          th, td { text-align:left; padding:12px 16px; font-size:.9rem; border-bottom:1px solid var(--line); }
          th { background:var(--tint); color:var(--navy); text-transform:uppercase; letter-spacing:.05em; font-size:.72rem; }
          tr:last-child td { border-bottom:0; }
          tr:hover td { background:#f8fbfc; }
          td.url { word-break:break-all; }
          td.url a { color:var(--brand); text-decoration:none; }
          td.url a:hover { text-decoration:underline; }
          td.num, td.mod { white-space:nowrap; color:var(--muted); }
          .foot { color:var(--muted); font-size:.8rem; margin:18px 0 40px; }
        </style>
      </head>
      <body>
        <div class="bar">
          <div class="wrap">
            <h1>XML Sitemap</h1>
            <p>Health Hub Tweed Coast — this file helps search engines discover every page on the site.</p>
          </div>
        </div>
        <div class="wrap">
          <xsl:choose>
            <!-- Sitemap index: a list of sub-sitemaps -->
            <xsl:when test="s:sitemapindex">
              <p class="note">This is a sitemap index containing <strong><xsl:value-of select="count(s:sitemapindex/s:sitemap)" /></strong> sitemap<xsl:if test="count(s:sitemapindex/s:sitemap) != 1">s</xsl:if>.</p>
              <table>
                <thead><tr><th>Sitemap</th><th>Last modified</th></tr></thead>
                <tbody>
                  <xsl:for-each select="s:sitemapindex/s:sitemap">
                    <tr>
                      <td class="url"><a href="{s:loc}"><xsl:value-of select="s:loc" /></a></td>
                      <td class="mod"><xsl:value-of select="s:lastmod" /></td>
                    </tr>
                  </xsl:for-each>
                </tbody>
              </table>
            </xsl:when>
            <!-- URL set: the actual page list -->
            <xsl:otherwise>
              <p class="count"><xsl:value-of select="count(s:urlset/s:url)" /> URLs in this sitemap</p>
              <table>
                <thead><tr><th>URL</th><th>Last modified</th></tr></thead>
                <tbody>
                  <xsl:for-each select="s:urlset/s:url">
                    <tr>
                      <td class="url"><a href="{s:loc}"><xsl:value-of select="s:loc" /></a></td>
                      <td class="mod"><xsl:value-of select="s:lastmod" /></td>
                    </tr>
                  </xsl:for-each>
                </tbody>
              </table>
            </xsl:otherwise>
          </xsl:choose>
          <p class="foot">Generated for healthhubtweedcoast.com.au</p>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
