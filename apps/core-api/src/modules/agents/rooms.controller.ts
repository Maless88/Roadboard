import { Body, Controller, Get, Inject, Param, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../common/auth.guard";
import { CurrentUser } from "../../common/user.decorator";
import type { AuthUser } from "../../common/auth-user";
import { RoomsService } from "./rooms.service";
import type { CreateRoomInput } from "./rooms.service";

@UseGuards(AuthGuard)
@Controller("agents/rooms")
export class RoomsController {

  constructor(@Inject(RoomsService) private readonly rooms: RoomsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<unknown> {
    return this.rooms.listRooms(user.userId);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: CreateRoomInput): Promise<unknown> {
    return this.rooms.createRoom(user.userId, body);
  }

  @Get(":id")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<unknown> {
    return this.rooms.getRoom(user.userId, id);
  }

  @Post(":id/messages")
  postMessage(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: { content: string },
  ): Promise<unknown> {
    return this.rooms.postMessage(user.userId, id, body.content);
  }

  @Post(":id/participants")
  addParticipant(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: { agentSlug: string },
  ): Promise<unknown> {
    return this.rooms.addParticipant(user.userId, id, body.agentSlug);
  }
}
