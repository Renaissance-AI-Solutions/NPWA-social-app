const { faker } = require('@faker-js/faker');
const fs = require('fs');
const path = require('path');

const NUM_USERS = 15;
const NUM_POSTS = 50;

console.log('Generating fake data...');

// --- Generate Users ---
const users = [];
for (let i = 0; i < NUM_USERS; i++) {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();

  users.push({
    // A unique identifier, like a Decentralized Identifier (DID)
    did: `did:plc:${faker.string.alphanumeric(24)}`,
    handle: faker.internet.userName({ firstName, lastName }).toLowerCase(),
    displayName: faker.person.fullName({ firstName, lastName }),
    avatar: faker.image.avatar(),
    bio: faker.lorem.sentence({ min: 5, max: 15 }),
    followersCount: faker.number.int({ min: 0, max: 5000 }),
    followsCount: faker.number.int({ min: 10, max: 1000 }),
  });
}

console.log(`Generated ${users.length} users.`);

// --- Generate Posts ---
const posts = [];
for (let i = 0; i < NUM_POSTS; i++) {
  // Pick a random author from our generated users
  const author = faker.helpers.arrayElement(users);

  posts.push({
    // A unique identifier for the post
    uri: `at://${author.did}/app.bsky.feed.post/${faker.string.alphanumeric(13)}`,
    author: author, // Embed the author's profile
    text: faker.lorem.paragraph({ min: 1, max: 3 }),
    createdAt: faker.date.recent({ days: 30 }), // A date within the last 30 days
    replyCount: faker.number.int({ min: 0, max: 150 }),
    repostCount: faker.number.int({ min: 0, max: 500 }),
    likeCount: faker.number.int({ min: 0, max: 2000 }),
    // Optionally, add a reply parent or a quote post
    reply: null,
    embed: null,
  });
}

console.log(`Generated ${posts.length} posts.`);

// --- Save to a file ---
const data = {
  users,
  posts,
};

// The output path will be relative to the project root, assuming `scripts` is in the root.
const outputDir = path.resolve(__dirname, '..', 'src', 'lib', 'api');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const outputPath = path.join(outputDir, 'fake-data.json');
fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));

console.log(`✅ Fake data saved to ${outputPath}`);