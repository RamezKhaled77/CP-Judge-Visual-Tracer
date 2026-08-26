FROM debian:bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends g++ gdb \
  && rm -rf /var/lib/apt/lists/*

# Non-root user that every compile/run/trace container executes as.
# UID/GID 1000 matches the typical first non-root user on Linux hosts so
# bind-mounted temp dirs stay readable/writable when the runner maps the
# host user into the container (--user).
RUN groupadd --gid 1000 sandboxgroup \
  && useradd --uid 1000 --gid sandboxgroup --create-home --shell /usr/sbin/nologin sandboxuser

USER sandboxuser
WORKDIR /work
