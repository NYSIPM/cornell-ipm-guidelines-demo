return {
  ["pesticide-summary"] = function(args, kwargs, meta)

    local title = kwargs["title"]

    if title == nil then
      title = "Untitled Pesticide Summary"
    else
      title = pandoc.utils.stringify(title)
    end

    local result = "Pesticide Summary Table: " .. title

    return pandoc.read(result, "markdown").blocks
  end
}