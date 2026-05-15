#!/bin/bash
cd "$(dirname "$0")"
npx prisma db push
npx next start -p ${PORT:-3000}
