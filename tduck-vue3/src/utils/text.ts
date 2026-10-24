// Parse inside an inert template, strip non-content nodes and return only text.
// Never attach this fragment to the live document or fetch embedded resources.
export function plainText(value: string | undefined): string {
  if (!value) return "";
  const template = document.createElement("template");
  template.innerHTML = value;
  template.content
    .querySelectorAll("script,style,iframe,object,embed,template")
    .forEach((node) => node.remove());
  return template.content.textContent || "";
}
