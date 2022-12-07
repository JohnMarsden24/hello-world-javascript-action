const core = require('@actions/core');
const github = require('@actions/github');
const { Octokit } = require('octokit');

const createReleasePage = async () => {
  const token = core.getInput('token');
  const octokit = new Octokit({ auth: token });

  const something = `+${token}+`;

  console.log(something);

  const { data } = await octokit.graphql(
    `
    query Jonny($name: String!, $owner: String!) {
      repository(name: $name, owner: $owner) {
        refs(refPrefix: "refs/tags/", first: 2, query: "prod-test", orderBy: {
        field: TAG_COMMIT_DATE,
        direction: DESC
        }) {
        totalCount
          nodes {
            name
            target {
              oid
              commitResourcePath
              abbreviatedOid
            }
          }
        }
      }
    }
  `,
    {
      name: 'hello-world-javascript-action',
      owner: 'johnmarsden24',
    }
  );
};

createReleasePage()
  .then((data) => console.log(JSON.stringify(data, null, 4)))
  .catch((err) => {
    console.log(err.message);
    core.setFailed(err.message);
  });
