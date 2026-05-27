FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS build
COPY . /usr/src/app
WORKDIR /usr/src/app
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm --filter @pulseai/api-service run build

FROM base
COPY --from=build /usr/src/app /usr/src/app
WORKDIR /usr/src/app/services/api-service
EXPOSE 3003
CMD [ "pnpm", "run", "start" ]
