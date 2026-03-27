return {
  ["pesticide-table"] = function(args, kwargs, meta)
    local guidelineId = pandoc.utils.stringify(kwargs["guidelineId"] or "")
    local pestId = pandoc.utils.stringify(kwargs["pestId"] or "")
    local siteId = pandoc.utils.stringify(kwargs["siteId"] or "")

    return pandoc.RawBlock(
      "html",
      string.format(
        [[<div class="pesticide-table-public"
     data-guideline-id="%s"
     data-pest-id="%s"
     data-site-id="%s">
  <div class="pesticide-table-loading">Loading pesticide table...</div>
</div>]],
        guidelineId, pestId, siteId
      )
    )
  end
}