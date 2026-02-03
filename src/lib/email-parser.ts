function parseEmailTemplate(template: string, data: Record<string, string>): string {
	return template.replace(/%\w+%/g, (match) => data[match.slice(1, -1)] || match);
}
export default parseEmailTemplate;
