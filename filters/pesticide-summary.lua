-- Public Quarto shortcode:
-- {{< pesticide-summary title="..." siteId="123" type="Insecticide" >}}

local function stringify(value)
  if value == nil then
    return ""
  end

  return pandoc.utils.stringify(value)
end

local function escape_html(value)
  return tostring(value or "")
    :gsub("&", "&amp;")
    :gsub("<", "&lt;")
    :gsub(">", "&gt;")
    :gsub('"', "&quot;")
    :gsub("'", "&#039;")
end

return {
  ["pesticide-summary"] = function(args, kwargs, meta)
    local title = stringify(kwargs["title"])
    local site_id = stringify(kwargs["siteId"])
    local summary_type = stringify(kwargs["type"])

    -- Outside the summary container: public-pesticide-summary.js replaces the
    -- container's contents when it loads. Same markup as the admin preview.
    local title_html = ""
    if title ~= "" then
      title_html = string.format(
        '<div class="pesticide-summary-title">%s</div>\n',
        escape_html(title)
      )
    end

    local html = title_html .. string.format(
      [[
<div
  class="pesticide-summary-public"
  data-pesticide-summary
  data-site-id="%s"
  data-summary-type="%s">
  Loading pesticide summary...
</div>
]],
      escape_html(site_id),
      escape_html(summary_type)
    )

    return pandoc.RawBlock("html", html)
  end
}