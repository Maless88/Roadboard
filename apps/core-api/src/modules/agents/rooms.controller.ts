import { Body, Controller, Delete, Get, Inject, Param, Post, Query, Sse, UseGuards } from "@nestjs/common";
import { Observable } from "rxjs";
import { optionalEnv } from "@roadboard/config";
import { AuthGuard } from "../../common/auth.guard";
import { LifeOsGuard } from "../../common/lifeos.guard";
import { CurrentUser } from "../../common/user.decorator";
import type { AuthUser } from "../../common/auth-user";
import { RoomsService } from "./rooms.service";
import type { CreateRoomInput } from "./rooms.service";
import { RoomOrchestratorService } from "./rooms-orchestrator.service";

@UseGuards(AuthGuard, LifeOsGuard)
@Controller("agents/rooms")
export class RoomsController {

  constructor(
    @Inject(RoomsService) private readonly rooms: RoomsService,
    @Inject(RoomOrchestratorService) private readonly orchestrator: RoomOrchestratorService,
  ) {}

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

  @Get(":id/messages")
  messages(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Query("before") before?: string,
    @Query("limit") limit?: string,
  ): Promise<unknown> {
    return this.rooms.listRoomMessages(user.userId, id, before, Number(limit) || 50);
  }

  @Post(":id/messages")
  postMessage(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: { content: string },
  ): Promise<unknown> {
    return this.rooms.postMessage(user.userId, id, body.content);
  }

  @Post("workspace")
  ensureWorkspace(@CurrentUser() user: AuthUser): Promise<unknown> {
    return this.rooms.ensureWorkspaceRoom(user.userId);
  }

  @Post("direct")
  ensureDirect(@CurrentUser() user: AuthUser, @Body() body: { agentSlug: string }): Promise<unknown> {
    return this.rooms.ensureDirectRoom(user.userId, body.agentSlug);
  }

  @Post(":id/participants")
  addParticipant(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: { agentSlug: string },
  ): Promise<unknown> {
    return this.rooms.addParticipant(user.userId, id, body.agentSlug);
  }


  @Delete(":id")
  deleteRoom(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<unknown> {
    return this.rooms.deleteRoom(user.userId, id);
  }


  @Delete(":id/messages")
  clearMessages(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<unknown> {
    return this.rooms.clearMessages(user.userId, id);
  }

  @Post(":id/share")
  share(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: { toAgentSlug: string },
  ): Promise<unknown> {
    return this.orchestrator.shareRoom(user.userId, id, body.toAgentSlug);
  }

  /** Drive one turn: post the message, let the director pick a responder, stream its reply. */
  @Sse(":id/turn")
  turn(
    @Param("id") id: string,
    @Query("message") message: string,
    @CurrentUser() user: AuthUser,
  ): Observable<{ data: string }> {
    if (optionalEnv("AGENTS_ENABLED", "false") !== "true") {
      return new Observable<{ data: string }>((s) => {
        s.next({ data: "[ERROR] agents disabled on this instance" });
        s.complete();
      });
    }
    return this.orchestrator.runTurn(user, id, message ?? "");
  }
}
