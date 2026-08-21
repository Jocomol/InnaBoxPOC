FROM maven:3.9.9-eclipse-temurin-17 AS build

WORKDIR /workspace
COPY pom.xml .
COPY src ./src
RUN mvn -B package

FROM eclipse-temurin:17-jre-alpine

RUN apk add --no-cache curl \
    && addgroup -S catering \
    && adduser -S catering -G catering
WORKDIR /app
COPY --from=build /workspace/target/catering-planner-*.jar app.jar
USER catering

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
