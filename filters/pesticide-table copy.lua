return {
  ["pesticide-table"] = function(args, kwargs, meta)
    return pandoc.RawBlock(
      "html",
      '<div style="border: 3px solid red; padding: 1rem;">SHORTCODE FIRED</div>'
    )
  end
}