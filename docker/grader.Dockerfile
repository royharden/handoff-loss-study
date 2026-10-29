# SOURCE ONLY. Hidden bundle is a grader-only readonly runtime bind, never a candidate mount.
FROM node:22.21.0-bookworm-slim
WORKDIR /runtime
RUN npm install --ignore-scripts --no-audit --no-fund --save-exact tsx@4.20.6 vitest@3.2.4 && useradd --uid 10002 --no-create-home grader
COPY src/sandbox/grader/protocol.ts src/sandbox/grader/client.ts src/sandbox/grader/entry.ts src/sandbox/grader/vitest.config.ts ./grader/
USER 10002
CMD ["node", "--import", "tsx", "/runtime/grader/entry.ts", "--group", "C0"]
