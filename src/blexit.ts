import * as fs from "fs";
import * as path from "path";
import * as xml2js from "xml2js";

interface Comment {
  commentId: string;
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
  date: Date;
  tags: string[];
  slug: string;
  content: string;
  isLinkBlog: boolean;
  urlLink?: string;
}

const xmlFilePath = path.join(
  __dirname,
  "../Squarespace-Wordpress-Export-07-15-2024.xml",
);
const postsDirectory = path.join(__dirname, "../public/posts");
const commentsDirectory = path.join(__dirname, "../public/comments");

// Ensure posts directory exists
if (!fs.existsSync(postsDirectory)) {
  console.log(`Creating ${postsDirectory}`);
  fs.mkdirSync(postsDirectory, { recursive: true });
}

if (!fs.existsSync(commentsDirectory)) {
  console.log(`Creating ${commentsDirectory}`);
  fs.mkdirSync(commentsDirectory, { recursive: true });
}

fs.readFile(xmlFilePath, "utf8", (err, data) => {
  if (err) {
    console.error("Error reading XML file:", err);
    return;
  }

  xml2js.parseString(data, (err, result) => {
    if (err) {
      console.error("Error parsing XML:", err);
      return;
    }

    const items = result.rss.channel[0].item;
    items.forEach((item: any) => {
      const type = getValueForKey(item, "wp:post_type");
      if (type === "post") {
        const postId = getValueForKey(item, "wp:post_id");
        const date = new Date(getValueForKey(item, "pubDate"));
        const title = getValueForKey(item, "title");
        const link = getValueForKey(item, "link");
        const categories = getArrayForKey(item, "category");
        const tags: string[] = [];
        const content = item["content:encoded"][0];
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
        });
        const comments = getArrayForKey(item, "wp:comment");
        let commentCount = 0;
        comments.forEach((comment: any) => {
          const commentDate = new Date(
            getValueForKey(comment, "wp:comment_date"),
          );
          const commentAuthor = getValueForKey(comment, "wp:comment_author");
          const commentUrl = getValueForKey(comment, "wp:comment_author_url");
          const text = getValueForKey(comment, "wp:comment_content");
          const authorEmail = getValueForKey(
            comment,
            "wp:comment_author_email",
          );
          const ip = getValueForKey(comment, "wp:comment_author_IP");
          const commentId = `${postId}-${commentCount}`;
          const theComment = {
            commentId: commentId,
            postId: postId,
            date: commentDate,
            name: commentAuthor,
            email: authorEmail,
            url: commentUrl,
            text: text,
            ip: ip,
          };
          commentCount++;
          writeComment(theComment, commentsDirectory);
        });
        const lastPart = link.substring(link.lastIndexOf("/") + 1);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const slug = `${year}-${month}-${lastPart}`;
        const post = {
          id: postId,
          title,
          date,
          slug,
          tags,
          isLinkBlog: !!urlLink,
          urlLink: urlLink,
          content,
        };
        writePost(post, postsDirectory);
      }
    });

    console.log("All markdown files have been generated.");
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

function writePost(rawPost: Post, directory: string) {
  const post = escapePostFields(rawPost);
  // build fileContent
  const fileContent = `---
id: ${post.id}
slug: ${post.slug}
title: ${post.title}
date: ${post.date.toISOString()}
${post.isLinkBlog ? "isLinkBlog: true" : ""}
${post.urlLink ? `urlLink: ${post.urlLink}` : ""}
${post.tags.length > 0 ? "\ntags:\n" : ""}
${post.tags.map((tag) => `  - ${tag}`).join("\n")}
---
${post.content}
`;
  const markdownFilePath = path.join(directory, `${rawPost.slug}.md`);
  fs.writeFileSync(markdownFilePath, fileContent);
  console.log(`Generated ${markdownFilePath}`);
}

function writeComment(rawComment: Comment, directory: string) {
  const comment = escapeCommentFields(rawComment);
  const fileContent = `---
commentId: ${comment.commentId}
postId: ${comment.postId}
name: ${comment.name}
ip: ${comment.ip}
date: ${comment.date.toISOString()}
${comment.email ? `email: ${comment.email}` : ""}
${comment.url ? `url: ${comment.url}` : ""}
---
${comment.text}`;
  const commentFilePath = path.join(directory, `${rawComment.commentId}.md`);
  fs.writeFileSync(commentFilePath, fileContent);
  console.log(`Generated ${commentFilePath}`);
}

function yEsc(value: string) {
  const unicoded = value
    .replace(/\\/g, "\\u005C") // Unicode for backslash
    .replace(/"/g, "\\u0022") // Unicode for double quotes
    .replace(/'/g, "\\u0027") // Unicode for single quotes
    .replace(/: /g, "\\u003A "); // Unicode for colon followed by space
  return '"' + unicoded + '"';
}

function escapeCommentFields(comment: Comment): Comment {
  return {
    ...comment,
    // text and date are not escaped
    commentId: yEsc(comment.commentId),
    postId: yEsc(comment.postId),
    name: yEsc(comment.name),
    url: comment.url ? yEsc(comment.url) : undefined,
    email: comment.email ? yEsc(comment.email) : undefined,
    ip: comment.ip ? yEsc(comment.ip) : undefined,
  };
}

function escapePostFields(post: Post): Post {
  return {
    ...post,
    // content and date are not escaped
    id: yEsc(post.id),
    title: yEsc(post.title),
    tags: post.tags.map((tag) => yEsc(tag)),
    slug: yEsc(post.slug),
    isLinkBlog: post.isLinkBlog,
    urlLink: post.urlLink ? yEsc(post.urlLink) : undefined,
  };
}
