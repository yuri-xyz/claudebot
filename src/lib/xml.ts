/** Wrap content in an XML tag: `<tag>\ncontent\n</tag>` */
export function wrapXml(tag: string, content: string): string {
  return `<${tag}>\n${content}\n</${tag}>`;
}
