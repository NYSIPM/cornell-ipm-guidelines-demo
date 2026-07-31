-- Public Quarto shortcode:
-- {{< pesticide-summary siteId="123" type="Insecticide" >}}

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
    local site_id = stringify(kwargs["siteId"])
    local summary_type = stringify(kwargs["type"])

    local html = string.format(
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