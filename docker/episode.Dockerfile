# SOURCE ONLY. Public smoke-test runtime, no hidden task material and no provider credentials.
FROM node:22.21.0-bookworm-slim
WORKDIR /runtime
RUN npm install --ignore-scripts --no-audit --no-fund --save-exact tsx@4.20.6 vitest@3.2.4 && useradd --uid 10001 --no-create-home episode
COPY src/sandbox/grader/public.ts src/sandbox/grader/public.config.ts ./grader/
USER 10001
# A trusted caller supplies explicit public-test filenames, never an arbitrary shell command.
CMD ["node", "--import", "tsx", "/runtime/grader/public.ts", "--tests"]
