import prisma from '../config/database';
import { AppError, CreateTagInput } from '../types';

export class TagService {
  async createTag(input: CreateTagInput) {
    const existingTag = await prisma.tag.findUnique({
      where: { name: input.name },
    });

    if (existingTag) {
      throw new AppError(400, 'TAG_EXISTS', 'Tag with this name already exists');
    }

    const tag = await prisma.tag.create({
      data: input,
    });

    return tag;
  }

  async getTags() {
    return prisma.tag.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateTag(tagId: string, input: Partial<CreateTagInput>) {
    const tag = await prisma.tag.findUnique({
      where: { id: tagId },
    });

    if (!tag) {
      throw new AppError(404, 'TAG_NOT_FOUND', 'Tag not found');
    }

    if (input.name && input.name !== tag.name) {
      const existingTag = await prisma.tag.findUnique({
        where: { name: input.name },
      });

      if (existingTag) {
        throw new AppError(400, 'TAG_EXISTS', 'Tag with this name already exists');
      }
    }

    return prisma.tag.update({
      where: { id: tagId },
      data: input,
    });
  }

  async deleteTag(tagId: string) {
    const tag = await prisma.tag.findUnique({
      where: { id: tagId },
    });

    if (!tag) {
      throw new AppError(404, 'TAG_NOT_FOUND', 'Tag not found');
    }

    await prisma.tag.delete({
      where: { id: tagId },
    });
  }
}

export default new TagService();