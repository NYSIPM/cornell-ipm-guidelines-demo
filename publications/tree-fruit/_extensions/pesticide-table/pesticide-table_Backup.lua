local function get_string(kwargs, name, default_value)
  local value = kwargs[name]

  if value == nil then
    return default_value or ""
  end

  return pandoc.utils.stringify(value)
end

local function markdown_escape(value)
  value = tostring(value or "")

  value = value:gsub("\r\n", " ")
  value = value:gsub("\n", " ")
  value = value:gsub("|", "\\|")

  return value
end

return {
  ["pesticide-table"] = function(args, kwargs, meta)

    local title = get_string(
      kwargs,
      "title",
      "Untitled Treatment Table"
    )

    local guideline_id = get_string(kwargs, "guidelineId")
    local pest_id = get_string(kwargs, "pestId")
    local site_id = get_string(kwargs, "siteId")
    local changed_since = get_string(kwargs, "changedSince")

    local command_arguments = {
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      "scripts/get-treatment-json.ps1",
      "-GuidelineId",
      guideline_id,
      "-PestId",
      pest_id,
      "-SiteId",
      site_id,
      "-ChangedSince",
      changed_since
    }

    local succeeded, result = pcall(
      pandoc.pipe,
      "powershell.exe",
      command_arguments,
      ""
    )

    if not succeeded then
      return pandoc.Div({
        pandoc.Para({
          pandoc.Strong({
            pandoc.Str("Treatment Table: " .. title)
          })
        }),

        pandoc.Para({
          pandoc.Str("The local API request failed.")
        }),

        pandoc.CodeBlock(tostring(result))
      })
    end

    local decode_succeeded, data = pcall(
      quarto.json.decode,
      result
    )

    if not decode_succeeded then
      return pandoc.Div({
        pandoc.Para({
          pandoc.Strong({
            pandoc.Str("Treatment Table: " .. title)
          })
        }),

        pandoc.Para({
          pandoc.Str("The API returned data, but Lua could not decode the JSON.")
        }),

        pandoc.CodeBlock(tostring(data))
      })
    end

    return pandoc.Div({
      pandoc.Para({
        pandoc.Strong({
          pandoc.Str("Treatment Table: " .. title)
        })
      }),

      pandoc.Para({
        pandoc.Str("Raw JSON returned by the local API:")
      }),

      pandoc.CodeBlock(result)
    })
    
  end
}