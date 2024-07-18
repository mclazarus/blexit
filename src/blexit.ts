import * as fs from 'fs';
import * as path from 'path';
import * as xml2js from 'xml2js';

interface Comment {
    postId: string;
    name: string;
    text: string;
    date: Date;
    url?: string;
    email?: string;
    ip?: string;
}

interface Post {
    id: string;
    title: string;
    author: string;
    date: Date;
    tags: string[];
    slug: string;
    content: string;
    isLinkBlog: boolean;
    urlLink?: string;
    comments: Comment[];
}

const xmlFilePath = path.join(__dirname, '../Squarespace-Wordpress-Export-07-15-2024.xml');
const postsDirectory = path.join(__dirname, '../public/posts');

// Ensure posts directory exists
if (!fs.existsSync(postsDirectory)) {
    fs.mkdirSync(postsDirectory, { recursive: true });
}

fs.readFile(xmlFilePath, 'utf8', (err, data) => {
    if (err) {
        console.error('Error reading XML file:', err);
        return;
    }

    xml2js.parseString(data, (err, result) => {
        if (err) {
            console.error('Error parsing XML:', err);
            return;
        }

        const items = result.rss.channel[0].item;
        items.forEach((item: any) => {
            // const metadata: PostMetadata = {
            //     title: item.title[0],
            //     author: item['dc:creator'][0],
            //     date: new Date(item.pubDate[0]).toISOString(),
            //     tags: item.category ? item.category.map((cat: any) => cat._) : [],
            //     slug: newSlug,
            //     content: item['content:encoded'][0]
            // };
            const type = getValueForKey(item, "wp:post_type");
            if (type === "post") {
                const postId = getValueForKey(item, "wp:post_id");
                const date = new Date(getValueForKey(item, "pubDate"));
                const title = getValueForKey(item, "title");
                const link = getValueForKey(item, "link");
                const categories = getArrayForKey(item, "category");
                const tags: string[] = [];
                const content = item['content:encoded'][0];
                categories.forEach((category: any) => {
                    const categoryName = getValueForKey(category, "_");
                    tags.push(categoryName);
                });
                let urlLink: string | undefined;
                const postMetas = getArrayForKey(item, "wp:postmeta");
                postMetas.forEach((postMeta: any) => {
                    const name = getValueForKey(postMeta, "wp:meta_key");
                    if (name === "passthrough_url") {
                        urlLink = getValueForKey(postMeta, "wp:meta_value");
                    }
                })
                const postComments: Comment[] = [];
                const comments = getArrayForKey(item, "wp:comment");
                comments.forEach((comment: any) => {
                    const commentDate = new Date(getValueForKey(comment, "wp:comment_date"));
                    const commentAuthor = getValueForKey(comment, "wp:comment_author");
                    const commentUrl = getValueForKey(comment, "wp:comment_author_url");
                    const text = getValueForKey(comment, "wp:comment_content");
                    const authorEmail = getValueForKey(comment, "wp:comment_author_email");
                    const ip = getValueForKey(comment, "wp:comment_author_IP");
                    const theComment = {
                        date: commentDate,
                        name: commentAuthor,
                        email: authorEmail,
                        url: commentUrl,
                        text: text,
                        ip: ip,
                    };
                    postComments.push(theComment);
                });
                const lastPart = link.substring(link.lastIndexOf('/') + 1);
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const slug = `${year}-${month}-${lastPart}`;
                const post = {
                    id: postId,
                    title,
                    date,
                    slug,
                    tags,
                    isLinkBlog: !!urlLink,
                    urlLink: urlLink,
                    comments: postComments,
                    content,
               }
               console.dir(post);
            }
        });

//             const frontMatter = `---
// title: "${metadata.title}"
// author: "${metadata.author}"
// date: ${metadata.date}
// tags:
// ${metadata.tags.map(tag => `  - ${tag}`).join('\n')}
// slug: ${metadata.slug}
// ---
//
// ${metadata.content.replace(/<\/?[^>]+(>|$)/g, "")}`;
//
//             const markdownFilePath = path.join(postsDirectory, `${newSlug}.md`);
//             fs.writeFileSync(markdownFilePath, frontMatter);
//             console.log(`Generated ${markdownFilePath}`);
//         });

        console.log('All markdown files have been generated.');
    });
});

function getValueForKey(object: any, key: string): string {
    const objectHasKey = key in object;
    if (objectHasKey) {
        const valueArray = object[key];
        if (Array.isArray(valueArray)) {
            return valueArray[0] as string;
        } else {
            return valueArray as string;
        }
    } else {
        if (key === "pubDate" || key === "wp:comment_date") {
            return "1970-01-01";
        } else {
            return "UNKNOWN";
        }
    }
}

function getArrayForKey(object: any, key: string): any[] {
    const objectHasKey = key in object;
    if (objectHasKey) {
        return object[key];
    } else {
        return [];
    }
}
