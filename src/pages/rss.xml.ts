import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { publishedPosts } from '@/lib/posts';
import { site } from '@/lib/site';

/** Blog feed. Metricool's "Blog" connection reads this to schedule social posts from new articles. */
export async function GET(context: APIContext) {
  const posts = await publishedPosts();
  return rss({
    title: `${site.name} blog`,
    description: `Notes from Watzaura on building ${site.product.name} and running sports academies.`,
    site: context.site ?? site.url,
    trailingSlash: false, // the site's URLs never end in /
    items: posts.map((p) => ({
      title: p.data.title,
      description: p.data.description,
      pubDate: p.data.date,
      link: `/blog/${p.id}`,
      author: `${site.email} (${p.data.author})`,
    })),
    customData: '<language>en-au</language>',
  });
}
