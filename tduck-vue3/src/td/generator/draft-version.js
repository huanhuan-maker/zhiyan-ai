// JSON objects may be returned with keys in a different order by the database.
// Question and option arrays retain their original order.
function orderedJson(value) {
  return JSON.stringify(value, (_key, item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item
    return Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]]))
  })
}

export function sameDraftSnapshot(left, right) {
  return orderedJson(left) === orderedJson(right)
}
