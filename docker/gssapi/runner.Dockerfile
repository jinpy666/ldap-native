FROM rockylinux:9

RUN dnf module reset -y nodejs \
  && dnf module enable -y nodejs:20 \
  && dnf install -y \
    nodejs \
    nodejs-devel \
    openldap-clients \
    openldap-devel \
    cyrus-sasl-devel \
    cyrus-sasl-gssapi \
    krb5-workstation \
    python3 \
    make \
    gcc-c++ \
    git \
    procps-ng \
    which \
    hostname \
    tcpdump \
  && dnf clean all \
  && rm -rf /var/cache/dnf

WORKDIR /workspace

CMD ["bash", "-lc", "sleep infinity"]
