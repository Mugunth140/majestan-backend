import { BadRequestException } from '@nestjs/common';

// Treat implausible residential square-foot measurements as unknown, never guess units.
export function usableArea(value: unknown, type: string): number | null {
  const number = Number(value);
  const minimum = ['apartment', 'villa', 'individual_portion'].includes(type) ? 100 : 1;
  return Number.isFinite(number) && number >= minimum ? number : null;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

// SEO fields are plain text; renderers escape once. Pasted HTML entities would
// otherwise reach search results as literal "&amp;". Repeat for "&amp;amp;".
export function decodeSeoEntities(value: string): string {
  let text = value;
  for (let pass = 0; pass < 3; pass += 1) {
    const next = text.replace(
      /&(?:#(\d{1,7})|#x([0-9a-f]{1,6})|([a-z]+));/gi,
      (match, dec: string, hex: string, name: string) => {
        if (name) return NAMED_ENTITIES[name.toLowerCase()] ?? match;
        const code = dec ? Number(dec) : parseInt(hex, 16);
        return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
      },
    );
    if (next === text) break;
    text = next;
  }
  return text;
}

export function cleanSeoText(value: string, city = ''): string {
  let text = decodeSeoEntities(value).replace(/\(\s*(?:0(?:\.0+)?\s*)?sq\.?\s*ft\.?\s*\)/gi, '').replace(/\s+/g, ' ').trim();
  if (city) {
    const escaped = city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text.replace(new RegExp(`(${escaped})(?:\\s*,?\\s+${escaped})+`, 'gi'), '$1');
  }
  return text.replace(/\s+([,])/g, '$1').trim();
}

/** Evaluate the most specific matching robots path rule; Allow wins equal specificity. */
export function validateRobotsPolicy(value: unknown): void {
  if (typeof value !== 'string') throw new BadRequestException('robots.txt must be text');
  const groups: { agents: string[]; rules: { allow: boolean; path: string }[] }[] = [];
  let group: (typeof groups)[number] | undefined;
  for (const raw of value.split(/\r?\n/)) {
    const line = raw.split('#')[0].trim();
    if (!line) continue;
    const separator = line.indexOf(':');
    if (separator < 0) throw new BadRequestException('Invalid robots.txt directive');
    const key = line.slice(0, separator).trim().toLowerCase(), path = line.slice(separator + 1).trim();
    if (key === 'user-agent') {
      if (!path) throw new BadRequestException('A robots user agent cannot be empty');
      if (!group || group.rules.length) { group = { agents: [], rules: [] }; groups.push(group); }
      group.agents.push(path.toLowerCase());
    } else if (key === 'allow' || key === 'disallow') {
      if (!group) throw new BadRequestException('Place robots rules after a User-agent');
      if (key === 'disallow' && /^\/\*?\$?$/.test(path)) throw new BadRequestException('A site-wide robots block is not allowed');
      if (path) group.rules.push({ allow: key === 'allow', path });
    }
  }
  if (!groups.some(g => g.agents.includes('*'))) throw new BadRequestException('robots.txt needs a User-agent: * group');
  const effective = (agent: string) => {
    const exact = groups.filter(g => g.agents.includes(agent));
    return (exact.length ? exact : groups.filter(g => g.agents.includes('*'))).flatMap(g => g.rules);
  };
  const allowed = (rules: (typeof groups)[number]['rules'], url: string) => {
    const matches = rules.filter(rule => {
      const escaped = rule.path.split('*').map(part => part.replace(/[.+?^{}()|[\]\\]/g, '\\$&')).join('.*');
      return new RegExp('^' + escaped).test(url);
    }).sort((a, b) => b.path.replace(/[*$]/g, '').length - a.path.replace(/[*$]/g, '').length || Number(b.allow) - Number(a.allow));
    return matches[0]?.allow ?? true;
  };
  for (const agent of new Set(['*', 'googlebot', 'bingbot', ...groups.flatMap(g => g.agents)])) {
    const rules = effective(agent);
    if (['/admin', '/admin/login', '/api', '/api/seo-admin'].some(path => allowed(rules, path)))
      throw new BadRequestException(`robots.txt must block /admin and /api for ${agent}`);
    if (['/', '/projects', '/apartments-for-sale-in-coimbatore'].some(path => !allowed(rules, path)))
      throw new BadRequestException(`robots.txt would block public pages for ${agent}`);
  }
}
