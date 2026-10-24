import { expect, it } from "vitest";
import { plainText } from "../../src/utils/text";
it("strips script and style contents as well as tags without executing HTML", () => {
  expect(
    plainText(
      '<img src=x onerror="window.__xss=1"><script>window.__xss=1</script><style>body{display:none}</style><b>Safe &amp; readable</b>'
    )
  ).toBe("Safe & readable");
  expect("__xss" in window).toBe(false);
});
