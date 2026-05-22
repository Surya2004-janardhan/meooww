FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package.json
RUN npm install

COPY tsconfig.json tsconfig.json
COPY prisma prisma
COPY src src

RUN npm run build

FROM node:20-alpine AS runtime

WORKDIR /app

COPY package.json package.json
RUN npm install --omit=dev

COPY --from=build /app/dist dist
COPY prisma prisma

EXPOSE 4000

CMD ["npm", "run", "start"]