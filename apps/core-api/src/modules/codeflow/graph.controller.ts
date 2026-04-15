import {
  Body, Controller, Delete, Get, Inject, Param, Patch, Post, UseGuards,
} from '@nestjs/common';
import { GrantType } from '@roadboard/domain';
import { AuthGuard } from '../../common/auth.guard';
import { GrantCheckGuard } from '../../common/grant-check.guard';
import { RequireGrant } from '../../common/require-grant.decorator';
import { CurrentUser } from '../../common/user.decorator';
import { GraphService } from './graph.service';
import { CreateNodeDto } from './dto/create-node.dto';
import { UpdateNodeDto } from './dto/update-node.dto';
import { CreateEdgeDto } from './dto/create-edge.dto';
import { CreateLinkDto } from './dto/create-link.dto';
import { CreateAnnotationDto } from './dto/create-annotation.dto';


@UseGuards(AuthGuard, GrantCheckGuard)
@Controller('projects/:projectId/codeflow/graph')
export class GraphController {

  constructor(@Inject(GraphService) private readonly graphService: GraphService) {}


  @RequireGrant(GrantType.CODEFLOW_READ)
  @Get()
  getGraph(@Param('projectId') projectId: string) {

    return this.graphService.getGraph(projectId);
  }


  @RequireGrant(GrantType.CODEFLOW_READ)
  @Get('snapshot')
  getSnapshot(@Param('projectId') projectId: string) {

    return this.graphService.getSnapshot(projectId);
  }


  // ── Nodes ──────────────────────────────────────────

  @RequireGrant(GrantType.CODEFLOW_WRITE)
  @Post('nodes')
  createNode(
    @Param('projectId') projectId: string,
    @Body() dto: CreateNodeDto,
    @CurrentUser() userId: string,
  ) {

    return this.graphService.createNode(projectId, dto, userId);
  }


  @RequireGrant(GrantType.CODEFLOW_READ)
  @Get('nodes/:nodeId')
  getNode(@Param('nodeId') nodeId: string) {

    return this.graphService.getNode(nodeId);
  }


  @RequireGrant(GrantType.CODEFLOW_WRITE)
  @Patch('nodes/:nodeId')
  updateNode(@Param('nodeId') nodeId: string, @Body() dto: UpdateNodeDto) {

    return this.graphService.updateNode(nodeId, dto);
  }


  @RequireGrant(GrantType.CODEFLOW_WRITE)
  @Delete('nodes/:nodeId')
  deleteNode(@Param('nodeId') nodeId: string) {

    return this.graphService.deleteNode(nodeId);
  }


  @RequireGrant(GrantType.CODEFLOW_READ)
  @Get('nodes/:nodeId/impact')
  getImpact(
    @Param('projectId') projectId: string,
    @Param('nodeId') nodeId: string,
  ) {

    return this.graphService.getImpact(nodeId, projectId);
  }


  @RequireGrant(GrantType.CODEFLOW_READ)
  @Get('nodes/:nodeId/links')
  listLinks(@Param('nodeId') nodeId: string) {

    return this.graphService.listLinks(nodeId);
  }


  @RequireGrant(GrantType.CODEFLOW_WRITE)
  @Post('nodes/:nodeId/links')
  createLink(
    @Param('nodeId') nodeId: string,
    @Param('projectId') projectId: string,
    @Body() dto: CreateLinkDto,
    @CurrentUser() userId: string,
  ) {

    return this.graphService.createLink(nodeId, projectId, dto, userId);
  }


  @RequireGrant(GrantType.CODEFLOW_WRITE)
  @Post('nodes/:nodeId/annotations')
  createAnnotation(
    @Param('nodeId') nodeId: string,
    @Param('projectId') projectId: string,
    @Body() dto: CreateAnnotationDto,
    @CurrentUser() userId: string,
  ) {

    return this.graphService.createAnnotation(nodeId, projectId, dto, userId);
  }


  // ── Edges ──────────────────────────────────────────

  @RequireGrant(GrantType.CODEFLOW_WRITE)
  @Post('edges')
  createEdge(
    @Param('projectId') projectId: string,
    @Body() dto: CreateEdgeDto,
  ) {

    return this.graphService.createEdge(projectId, dto);
  }


  @RequireGrant(GrantType.CODEFLOW_WRITE)
  @Delete('edges/:edgeId')
  deleteEdge(@Param('edgeId') edgeId: string) {

    return this.graphService.deleteEdge(edgeId);
  }


  // ── Links ──────────────────────────────────────────

  @RequireGrant(GrantType.CODEFLOW_WRITE)
  @Delete('links/:linkId')
  deleteLink(@Param('linkId') linkId: string) {

    return this.graphService.deleteLink(linkId);
  }
}
