/*
  Warnings:

  - The primary key for the `WatchList` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `_TagToWatchList` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE "_TagToWatchList" DROP CONSTRAINT "_TagToWatchList_B_fkey";

-- AlterTable
ALTER TABLE "WatchList" DROP CONSTRAINT "WatchList_pkey",
ADD COLUMN     "note" TEXT,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "WatchList_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "WatchList_id_seq";

-- AlterTable
ALTER TABLE "_TagToWatchList" DROP CONSTRAINT "_TagToWatchList_AB_pkey",
ALTER COLUMN "B" SET DATA TYPE TEXT,
ADD CONSTRAINT "_TagToWatchList_AB_pkey" PRIMARY KEY ("A", "B");

-- AddForeignKey
ALTER TABLE "_TagToWatchList" ADD CONSTRAINT "_TagToWatchList_B_fkey" FOREIGN KEY ("B") REFERENCES "WatchList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
