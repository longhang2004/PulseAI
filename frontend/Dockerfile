FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS build
COPY . /usr/src/app
WORKDIR /usr/src/app
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm --filter frontend run build

FROM base
COPY --from=build /usr/src/app /usr/src/app
WORKDIR /usr/src/app/frontend
EXPOSE 3000
CMD [ "pnpm", "run", "start" ]
