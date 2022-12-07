const core = require('@actions/core');
const { context } = require('@actions/github');
const { Octokit } = require('octokit');

const createReleasePage = async () => {
  const repo = 'hello-world-javascript-action';
  const owner = 'johnmarsden24';
  const token = core.getInput('token');
  const packageName = core.getInput('package-name');
  const parentDir = core.getInput('parent-dir');
  const octokit = new Octokit({ auth: token });

  console.log(JSON.stringify(context, null, 4));

  const { repository } = await octokit.graphql(
    `
    query GetPreviousTag($repo: String!, $owner: String!, $packageName: String!) {
      repository(name: $repo, owner: $owner) {
        refs(refPrefix: "refs/tags/", first: 1, query: $packageName, orderBy: {
        field: TAG_COMMIT_DATE,
        direction: ASC
        }) {
          nodes {
            name
          }
        }
      }
    }
  `,
    {
      repo,
      owner,
      packageName,
    }
  );

  const previousTag = repository.refs.nodes[0]?.name;

  let previousReleaseDate;

  if (previousTag) {
    const {
      repository: { release },
    } = await octokit.graphql(
      `
      query GetPreviousTag($repo: String!, $owner: String!, $tagName: String!) {
        repository(name: $repo, owner: $owner) {
          release(tagName: $tagName) {
            publishedAt
          }
        }
      }
    `,
      {
        repo,
        owner,
        tagName: previousTag,
      }
    );

    previousReleaseDate = release.publishedAt;
  }

  const shortSha = context.sha.slice(0, 7);
  const newTag = `${packageName}-release-${shortSha}`;

  const queryParams = `sha=${
    context.sha
  }&path=${`${parentDir}/${packageName}`}${
    previousReleaseDate ? `&since=${previousReleaseDate}` : ''
  }`;

  console.log({ queryParams });

  const { data: commits } = await octokit.request(
    `GET /repos/${owner}/${repo}/commits?${queryParams}`,
    {
      owner,
      repo,
    }
  );

  console.log(JSON.stringify(commits, null, 4));

  console.log({
    newTag,
    previousTag,
  });

  const mappedCommits = commits
    .map(
      (parent) =>
        `* ${parent.sha} ${parent.commit.message} @${parent.author.login}`
    )
    .join('\n');

  console.log(mappedCommits);

  // const { data } = await octokit.request(
  //   `POST /repos/${owner}/${repo}/releases/generate-notes`,
  //   {
  //     owner,
  //     repo,
  //     tag_name: newTag,
  //     ...(previousTag && { previous_tag_name: previousTag }),
  //   }
  // );
  const markup = await octokit.request('POST /markdown', {
    mode: 'gfm',
    context: 'JohnMarsden24/hello-world-javascript-action',
    text: mappedCommits,
  });

  await octokit.request(`POST /repos/${owner}/${repo}/releases`, {
    owner,
    repo,
    tag_name: newTag,
    name: newTag,
    body: markup.data,
    // generate_release_notes: true,
  });
};

createReleasePage()
  .then(() => console.log('success!'))
  .catch((err) => {
    console.log(err.message);
    core.setFailed(err.message);
  });
