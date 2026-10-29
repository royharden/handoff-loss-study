# SOURCE ONLY: never built during Dirty Mode. Pin resulting image digest before approval.
FROM node:22.21.0-bookworm-slim
WORKDIR /runtime
RUN npm install --ignore-scripts --no-audit --no-fund --save-exact tsx@4.20.6 && useradd --uid 10001 --no-create-home candidate
# Explicit public-only COPY allowlist. No hidden tests, oracle, predicates, mutants or task bundle.
COPY src/sandbox/grader/protocol.ts src/sandbox/grader/shim.ts ./grader/
USER 10001
CMD ["node", "--import", "tsx", "/runtime/grader/shim.ts", "--serve"]
