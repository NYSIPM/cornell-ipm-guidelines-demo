-- Public Quarto shortcode:
-- {{< pesticide-table title="..." guidelineId="1" pestId="2" siteId="3" >}}

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
  ["pesticide-table"] = function(args, kwargs, meta)
    local title = stringify(kwargs["title"])
    local guidelineId = stringify(kwargs["guidelineId"])
    local pestId = stringify(kwargs["pestId"])
    local siteId = stringify(kwargs["siteId"])

    -- Outside the table container: public-treatment-builder.js replaces the
    -- container's contents when it loads. Same markup as the admin preview.
    local title_html = ""
    if title ~= "" then
      title_html = string.format(
        '<div class="treatment-table-title">%s</div>\n',
        escape_html(title)
      )
    end

    return pandoc.RawBlock(
      "html",
      title_html .. string.format(
        [[<div class="pesticide-table-public"
     data-guideline-id="%s"
     data-pest-id="%s"
     data-site-id="%s">
  <div class="pesticide-table-loading">Loading pesticide table...</div>
</div>]],
        escape_html(guidelineId), escape_html(pestId), escape_html(siteId)
      )
    )
  end
}
