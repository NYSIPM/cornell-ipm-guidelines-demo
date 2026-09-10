local function get_string(kwargs, name, default_value)
  local value = kwargs[name]

  if value == nil then
    return default_value or ""
  end

  return pandoc.utils.stringify(value)
end

local function clean(value)
  if value == nil then
    return ""
  end

  if type(value) == "table" then
    return ""
  end

  local text = tostring(value)

  text = text:gsub("\r\n", " ")
  text = text:gsub("\n", " ")
  text = text:gsub("\r", " ")

  -- Replace common UTF-8 punctuation.
  text = text:gsub("\226\128\152", "'")
  text = text:gsub("\226\128\153", "'")
  text = text:gsub("\226\128\156", '"')
  text = text:gsub("\226\128\157", '"')
  text = text:gsub("\226\128\147", "-")
  text = text:gsub("\226\128\148", "-")
  text = text:gsub("\226\128\166", "...")

  -- Remove any remaining malformed high bytes.
  text = text:gsub("[\128-\255]", "")

  text = text:gsub("%s+", " ")
  text = text:match("^%s*(.-)%s*$") or ""

  return text
end

local function markdown_escape(value)
  local text = clean(value)

  text = text:gsub("\\", "\\\\")
  text = text:gsub("|", "\\|")

  return text
end

local function unique(values)
  local seen = {}
  local results = {}

  for _, value in ipairs(values or {}) do
    local text = clean(value)

    if text ~= "" and not seen[text] then
      seen[text] = true
      table.insert(results, text)
    end
  end

  return results
end

local function join_unique(values, separator)
  return table.concat(
    unique(values),
    separator or ", "
  )
end

local function format_rate(rate)
  if not rate then
    return ""
  end

  local concentration = clean(rate.concentration)
  local amount_note = clean(rate.amountNote)

  local unit = ""
  if rate.unit then
    unit = clean(rate.unit.name)
  end

  local unit_area = ""
  if rate.unitArea then
    unit_area = clean(rate.unitArea.name)
  end

  local parts = {}

  if concentration ~= "" then
    table.insert(parts, concentration)
  end

  if unit ~= "" then
    table.insert(parts, unit)
  end

  local text = table.concat(parts, " ")

  if unit_area ~= "" then
    if text ~= "" then
      text = text .. " / " .. unit_area
    else
      text = unit_area
    end
  end

  if amount_note ~= "" then
    if text ~= "" then
      text = text .. " (" .. amount_note .. ")"
    else
      text = amount_note
    end
  end

  return clean(text)
end

local function get_treatment_type(treatment)
  local control_technique = treatment.controlTechnique

  if not control_technique then
    return ""
  end

  if #(control_technique.pesticides or {}) > 0 then
    return "pesticide"
  end

  if #(control_technique.biologicalControls or {}) > 0 then
    return "biological"
  end

  if #(control_technique.culturalPractices or {}) > 0 then
    return "cultural"
  end

  return ""
end

local function get_control_technique_name(treatment)
  local control_technique = treatment.controlTechnique

  if not control_technique then
    return ""
  end

  local names = {}

  for _, pesticide in ipairs(
    control_technique.pesticides or {}
  ) do
    local trade_name = clean(pesticide.tradeName)
    local common_name = clean(pesticide.commonName)

    if trade_name ~= "" and common_name ~= "" then
      table.insert(
        names,
        trade_name .. " (" .. common_name .. ")"
      )
    elseif trade_name ~= "" then
      table.insert(names, trade_name)
    elseif common_name ~= "" then
      table.insert(names, common_name)
    end
  end

  for _, biological in ipairs(
    control_technique.biologicalControls or {}
  ) do
    local name = clean(biological.name)

    if name ~= "" then
      table.insert(names, name)
    end
  end

  for _, cultural in ipairs(
    control_technique.culturalPractices or {}
  ) do
    local name = clean(cultural.name)

    if name ~= "" then
      table.insert(names, name)
    end
  end

  return join_unique(names, ", ")
end

local function get_description_text(treatment)
  local control_technique = treatment.controlTechnique

  if not control_technique then
    return ""
  end

  local descriptions = {}

  for _, biological in ipairs(
    control_technique.biologicalControls or {}
  ) do
    local description = clean(biological.description)

    if description ~= "" then
      table.insert(descriptions, description)
    end
  end

  for _, cultural in ipairs(
    control_technique.culturalPractices or {}
  ) do
    local description = clean(cultural.description)

    if description ~= "" then
      table.insert(descriptions, description)
    end
  end

  return join_unique(descriptions, "; ")
end

local function get_restricted_use_symbols(treatment)
  local control_technique = treatment.controlTechnique or {}
  local symbols = {}

  for _, pesticide in ipairs(
    control_technique.pesticides or {}
  ) do
    for _, item in ipairs(
      pesticide.restrictedUse or {}
    ) do
      local symbol = clean(item.symbol)

      if symbol ~= "" then
        table.insert(symbols, symbol)
      end
    end
  end

  return join_unique(symbols, " ")
end

local function get_rate_text(treatment)
  local values = {}

  for _, rate in ipairs(
    treatment.treatmentRates or {}
  ) do
    local text = format_rate(rate)

    if text ~= "" then
      table.insert(values, text)
    end
  end

  return join_unique(values, "; ")
end

local function format_rei(site_pesticide_list)
  local site_pesticide =
    (site_pesticide_list or {})[1]

  if not site_pesticide then
    return ""
  end

  local parts = {}
  local rei = clean(site_pesticide.rei)

  if rei ~= "" then
    table.insert(parts, rei .. " hr")
  end

  if site_pesticide.reiReferToLabel == true then
    table.insert(parts, "Refer To Label")
  end

  if site_pesticide.reiUntilDry == true then
    table.insert(parts, "Until Dry")
  end

  return table.concat(parts, "; ")
end

local function get_rei_text(treatment)
  local control_technique = treatment.controlTechnique or {}
  local values = {}

  for _, pesticide in ipairs(
    control_technique.pesticides or {}
  ) do
    local text = format_rei(
      pesticide.sitePesticide
    )

    if text ~= "" then
      table.insert(values, text)
    end
  end

  return join_unique(values, "; ")
end

local function format_phi(site_pesticide_list)
  local site_pesticide =
    (site_pesticide_list or {})[1]

  if not site_pesticide then
    return ""
  end

  local parts = {}

  local phi = clean(site_pesticide.phi)
  local phi_time = clean(site_pesticide.phiTime)

  if phi ~= "" then
    if phi_time ~= "" then
      table.insert(parts, phi .. " " .. phi_time)
    else
      table.insert(parts, phi)
    end
  end

  if site_pesticide.phiReferToLabel == true then
    table.insert(parts, "Refer To Label")
  end

  if site_pesticide.phiUntilDry == true then
    table.insert(parts, "Until Dry")
  end

  return table.concat(parts, "; ")
end

local function get_phi_text(treatment)
  local control_technique = treatment.controlTechnique or {}
  local values = {}

  for _, pesticide in ipairs(
    control_technique.pesticides or {}
  ) do
    local text = format_phi(
      pesticide.sitePesticide
    )

    if text ~= "" then
      table.insert(values, text)
    end
  end

  return join_unique(values, "; ")
end

local function format_resistance(pesticide)
  local irac_values = {}
  local frac_values = {}

  for _, ingredient in ipairs(
    pesticide.activeIngredients or {}
  ) do
    local insecticide =
      ingredient.activeIngredientInsecticide

    local fungicide =
      ingredient.activeIngredientFungicide

    local irac = ""
    local frac = ""

    if insecticide then
      irac = clean(insecticide.irac)
    end

    if fungicide then
      frac = clean(fungicide.frac)
    end

    if irac ~= "" then
      table.insert(irac_values, irac)
    end

    if frac ~= "" then
      table.insert(frac_values, frac)
    end
  end

  local irac_text =
    join_unique(irac_values, ", ")

  local frac_text =
    join_unique(frac_values, ", ")

  if irac_text ~= "" and frac_text ~= "" then
    return "IRAC: "
      .. irac_text
      .. " / FRAC: "
      .. frac_text
  end

  if irac_text ~= "" then
    return "IRAC: " .. irac_text
  end

  if frac_text ~= "" then
    return "FRAC: " .. frac_text
  end

  return ""
end

local function get_resistance_text(treatment)
  local control_technique = treatment.controlTechnique or {}
  local values = {}

  for _, pesticide in ipairs(
    control_technique.pesticides or {}
  ) do
    local text = format_resistance(pesticide)

    if text ~= "" then
      table.insert(values, text)
    end
  end

  return join_unique(values, "; ")
end

local function get_efficacy_text(treatment)
  if not treatment.efficacy then
    return ""
  end

  return clean(treatment.efficacy.name)
end

local function get_comment_values(treatment)
  local values = {}

  for _, comment in ipairs(treatment.comments or {}) do
    local text = clean(
      comment.comment or comment.commentText
    )

    if text ~= "" then
      table.insert(values, text)
    end
  end

  return unique(values)
end

local function text_blocks(
  value,
  shaded,
  bold,
  left_edge,
  right_edge
)
  local text = clean(value)
  local inlines = {}

  if shaded then
    table.insert(
      inlines,
      pandoc.RawInline(
        "latex",
        "\\cellcolor{TreatmentGray}"
      )
    )
  end

  if bold then
    table.insert(
      inlines,
      pandoc.Strong({
        pandoc.Str(text)
      })
    )
  else
    table.insert(
      inlines,
      pandoc.Str(text)
    )
  end

  return {
    pandoc.Plain(inlines)
  }
end

local function table_cell(
  value,
  colspan,
  shaded,
  bold,
  left_edge,
  right_edge
)
  return pandoc.Cell(
    text_blocks(
      value,
      shaded,
      bold,
      left_edge,
      right_edge
    ),
    pandoc.AlignLeft,
    1,
    colspan or 1
  )
end

local function separator_cell()
  return pandoc.Cell(
    {
      pandoc.Plain({
        pandoc.RawInline(
          "latex",
          "\\rule{\\linewidth}{0.4pt}"
        )
      })
    },
    pandoc.AlignLeft,
    1,
    6
  )
end

return {
  ["pesticide-table"] = function(args, kwargs, meta)
    local title = get_string(
      kwargs,
      "title",
      "Untitled Treatment Table"
    )

    local guideline_id =
      get_string(kwargs, "guidelineId")

    local pest_id =
      get_string(kwargs, "pestId")

    local site_id =
      get_string(kwargs, "siteId")

    local changed_since =
      get_string(kwargs, "changedSince")

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

    local request_succeeded, result = pcall(
      pandoc.pipe,
      "powershell.exe",
      command_arguments,
      ""
    )

    if not request_succeeded then
      return pandoc.Div({
        pandoc.Para({
          pandoc.Strong({
            pandoc.Str(
              "Treatment Table: " .. title
            )
          })
        }),

        pandoc.Para({
          pandoc.Str(
            "The local API request failed."
          )
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
            pandoc.Str(
              "Treatment Table: " .. title
            )
          })
        }),

        pandoc.Para({
          pandoc.Str(
            "The API response could not be decoded."
          )
        }),

        pandoc.CodeBlock(tostring(data))
      })
    end

    local treatments = data

    if type(data) ~= "table" then
      treatments = {}
    end

   local header = pandoc.TableHead({
      pandoc.Row({
        table_cell(
          "Control Technique",
          1,
          false,
          true
        ),
        table_cell(
          "Rate",
          1,
          false,
          true
        ),
        table_cell(
          "REI",
          1,
          false,
          true
        ),
        table_cell(
          "PHI",
          1,
          false,
          true
        ),
        table_cell(
          "Resistance Mgmt.",
          1,
          false,
          true
        ),
        table_cell(
          "Efficacy",
          1,
          false,
          true
        )
      })
    })

    local body_rows = {}

    for treatment_index, treatment in ipairs(treatments) do
      local shaded = treatment_index % 2 == 1
      local treatment_type =
        get_treatment_type(treatment)

      local control_name =
        get_control_technique_name(treatment)

      local restricted_symbols =
        get_restricted_use_symbols(treatment)

      if restricted_symbols ~= "" then
        control_name =
          restricted_symbols .. " " .. control_name
      end

      local rate = ""
      local rei = ""
      local phi = ""
      local resistance = ""

      if treatment_type == "pesticide" then
        rate = get_rate_text(treatment)
        rei = get_rei_text(treatment)
        phi = get_phi_text(treatment)
        resistance =
          get_resistance_text(treatment)
      else
        local description =
          get_description_text(treatment)

        if description ~= "" then
          if control_name ~= "" then
            control_name =
              control_name .. ": " .. description
          else
            control_name = description
          end
        end
      end

      local efficacy =
        get_efficacy_text(treatment)

      -- Main six-column treatment row.
      table.insert(
        body_rows,
        pandoc.Row({
          table_cell(
            control_name,
            1,
            shaded,
            false,
            true,
            false
          ),

          table_cell(rate, 1, shaded),
          table_cell(rei, 1, shaded),
          table_cell(phi, 1, shaded),
          table_cell(resistance, 1, shaded),

          table_cell(
            efficacy,
            1,
            shaded,
            false,
            false,
            true
          )
        })
      )

      -- Comment row spanning all six columns.
      local comments =
        get_comment_values(treatment)

            if #comments > 0 then
        local comment_inlines = {}

        if shaded then
          table.insert(
            comment_inlines,
            pandoc.RawInline(
              "latex",
              "\\cellcolor{TreatmentGray}"
            )
          )
        end

        -- Add modest vertical height inside the colored cell.
        table.insert(
          comment_inlines,
          pandoc.RawInline(
            "latex",
            "\\rule{0pt}{1.15em}"
          )
        )

        for comment_index, comment in ipairs(comments) do
          if comment_index > 1 then
            table.insert(
              comment_inlines,
              pandoc.LineBreak()
            )
          end

          table.insert(
            comment_inlines,
            pandoc.Str(comment)
          )
        end

        local comment_cell = pandoc.Cell(
          {
            pandoc.Plain(comment_inlines)
          },
          pandoc.AlignLeft,
          1,
          6
        )

        table.insert(
          body_rows,
          pandoc.Row({
            comment_cell
          })
        )
      end

      if treatment_index < #treatments then
        table.insert(
          body_rows,
          pandoc.Row({
            separator_cell()
          })
        )
      end
    end

    if #treatments == 0 then
      table.insert(
        body_rows,
        pandoc.Row({
          table_cell(
            "No treatments found",
            6
          )
        })
      )
    end

    local colspecs = {
      { pandoc.AlignLeft, 0.30 },
      { pandoc.AlignLeft, 0.16 },
      { pandoc.AlignLeft, 0.11 },
      { pandoc.AlignLeft, 0.11 },
      { pandoc.AlignLeft, 0.20 },
      { pandoc.AlignLeft, 0.12 }
    }

    local bodies = {
      {
        attr = {},
        body = body_rows,
        head = {},
        row_head_columns = 0
      }
    }

    local treatment_table = pandoc.Table(
      pandoc.Caption(),
      colspecs,
      header,
      bodies,
      pandoc.TableFoot()
    )

    return {
      pandoc.Para({
        pandoc.Strong({
          pandoc.Str(title)
        })
      }),

      treatment_table
    }
  end
}