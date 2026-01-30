-- filters/api-insert.lua
-- Replace ::: {.api-insert endpoint="..."} ::: with fetched HTML or Markdown.

local function trim(s)
  return (s:gsub("^%s+", ""):gsub("%s+$", ""))
end

local function fetch_url(url)
  -- Use curl (works well on Netlify build images)
  local cmd = 'curl -L -s --fail "' .. url .. '"'
  local handle = io.popen(cmd)
  if not handle then
    return nil, "unable to run curl"
  end
  local result = handle:read("*a")
  local ok = handle:close()
  if not ok then
    return nil, "curl failed"
  end
  return trim(result), nil
end

local function has_class(el, class)
  for _, c in ipairs(el.classes or {}) do
    if c == class then return true end
  end
  return false
end

function Div(el)
  if not has_class(el, "api-insert") then
    return nil
  end

  local endpoint = el.attributes and el.attributes["endpoint"] or nil
  if not endpoint or endpoint == "" then
    return pandoc.Div({ pandoc.Para({ pandoc.Str("api-insert: missing endpoint") }) })
  end

  -- Default to html because that’s your current plan
  local fmt = "html"
  if el.attributes and el.attributes["format"] and el.attributes["format"] ~= "" then
    fmt = string.lower(el.attributes["format"])
  end

  local body, err = fetch_url(endpoint)
  if not body then
    return pandoc.Div({
      pandoc.Para({ pandoc.Str("api-insert fetch failed: " .. err) }),
      pandoc.Para({ pandoc.Str("endpoint: " .. endpoint) })
    })
  end

  if fmt == "markdown" or fmt == "md" then
    -- Parse markdown into real blocks (safe: it becomes normal Pandoc AST)
    local doc = pandoc.read(body, "markdown")
    return pandoc.Div(doc.blocks)

  else
    -- Treat as HTML by default
    -- NOTE: this injects raw HTML into output. Only do this for trusted endpoints.
    return pandoc.Div({ pandoc.RawBlock("html", body) })
  end
end
