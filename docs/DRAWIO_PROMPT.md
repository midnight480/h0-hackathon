# Hiravi Architecture Diagram — draw.io XML

## Usage

Open draw.io (or diagrams.net) and import this XML via File → Import from → Device, or paste into the XML editor.

---

## Architecture Diagram XML

```xml
<mxGraphModel dx="1422" dy="762" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1600" pageHeight="900" math="0" shadow="0">
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>

    <!-- Title -->
    <mxCell id="title" value="&lt;font style=&quot;font-size: 20px;&quot;&gt;&lt;b&gt;Hiravi — System Architecture&lt;/b&gt;&lt;/font&gt;&lt;br&gt;Global Slide Sharing + Auto-Translation Platform" style="text;html=1;align=center;verticalAlign=middle;resizable=0;points=[];autosize=1;" vertex="1" parent="1">
      <mxGeometry x="500" y="10" width="500" height="50" as="geometry"/>
    </mxCell>

    <!-- User -->
    <mxCell id="user" value="&lt;b&gt;Global Users&lt;/b&gt;&lt;br&gt;(Browsers / Mobile)" style="shape=mxgraph.aws4.users;sketch=0;html=1;fillColor=#232F3E;fontColor=#ffffff;strokeColor=none;verticalLabelPosition=bottom;verticalAlign=top;labelBackgroundColor=none;" vertex="1" parent="1">
      <mxGeometry x="700" y="70" width="60" height="60" as="geometry"/>
    </mxCell>

    <!-- Vercel Edge Network -->
    <mxCell id="vercel_group" value="&lt;b&gt;Vercel Platform&lt;/b&gt;" style="swimlane;startSize=25;fillColor=#E3F2FD;strokeColor=#1565C0;rounded=1;arcSize=8;html=1;fontSize=12;" vertex="1" parent="1">
      <mxGeometry x="440" y="170" width="580" height="130" as="geometry"/>
    </mxCell>
    <mxCell id="cdn" value="&lt;b&gt;Edge CDN&lt;/b&gt;&lt;br&gt;ISR Cache&lt;br&gt;Image Optimization" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#BBDEFB;strokeColor=#1565C0;fontSize=10;" vertex="1" parent="vercel_group">
      <mxGeometry x="20" y="35" width="130" height="80" as="geometry"/>
    </mxCell>
    <mxCell id="nextjs" value="&lt;b&gt;Next.js App&lt;/b&gt;&lt;br&gt;Server Components&lt;br&gt;Server Actions&lt;br&gt;API Routes" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#BBDEFB;strokeColor=#1565C0;fontSize=10;" vertex="1" parent="vercel_group">
      <mxGeometry x="170" y="35" width="130" height="80" as="geometry"/>
    </mxCell>
    <mxCell id="waf" value="&lt;b&gt;WAF + DDoS&lt;/b&gt;&lt;br&gt;Bot Protection&lt;br&gt;Rate Limiting" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#BBDEFB;strokeColor=#1565C0;fontSize=10;" vertex="1" parent="vercel_group">
      <mxGeometry x="320" y="35" width="120" height="80" as="geometry"/>
    </mxCell>
    <mxCell id="vercel_webhook" value="&lt;b&gt;Webhook&lt;/b&gt;&lt;br&gt;revalidateTag" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#BBDEFB;strokeColor=#1565C0;fontSize=10;" vertex="1" parent="vercel_group">
      <mxGeometry x="460" y="35" width="100" height="80" as="geometry"/>
    </mxCell>

    <!-- Clerk -->
    <mxCell id="clerk" value="&lt;b&gt;Clerk&lt;/b&gt;&lt;br&gt;OAuth (Google/GitHub)&lt;br&gt;Session + MFA&lt;br&gt;Webhook Sync" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#F3E5F5;strokeColor=#7B1FA2;fontSize=10;" vertex="1" parent="1">
      <mxGeometry x="200" y="200" width="150" height="80" as="geometry"/>
    </mxCell>

    <!-- Upstash Redis -->
    <mxCell id="upstash" value="&lt;b&gt;Upstash Redis&lt;/b&gt;&lt;br&gt;Rate Limiting (IP+User)&lt;br&gt;HyperLogLog Analytics" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFF3E0;strokeColor=#E65100;fontSize=10;" vertex="1" parent="1">
      <mxGeometry x="1080" y="200" width="160" height="80" as="geometry"/>
    </mxCell>

    <!-- AWS Region 1 -->
    <mxCell id="aws_region1" value="&lt;b&gt;AWS Region: ap-northeast-1 (Tokyo)&lt;/b&gt;" style="swimlane;startSize=25;fillColor=#FFF8E1;strokeColor=#FF8F00;rounded=1;arcSize=8;html=1;fontSize=11;" vertex="1" parent="1">
      <mxGeometry x="200" y="360" width="900" height="280" as="geometry"/>
    </mxCell>

    <!-- Aurora DSQL Primary -->
    <mxCell id="dsql1" value="&lt;b&gt;Aurora DSQL&lt;/b&gt;&lt;br&gt;(Primary)&lt;br&gt;&lt;hr&gt;&lt;font style=&quot;font-size:9px;&quot;&gt;Users | Decks | Slides&lt;br&gt;Events | Translations&lt;br&gt;Views | Likes&lt;/font&gt;" style="shape=cylinder3;whiteSpace=wrap;html=1;fillColor=#C8E6C9;strokeColor=#2E7D32;size=12;fontSize=10;" vertex="1" parent="aws_region1">
      <mxGeometry x="30" y="45" width="160" height="120" as="geometry"/>
    </mxCell>

    <!-- S3 -->
    <mxCell id="s3" value="&lt;b&gt;Amazon S3&lt;/b&gt;&lt;br&gt;&lt;hr&gt;&lt;font style=&quot;font-size:9px;&quot;&gt;PDF Originals (private)&lt;br&gt;Slide Images (public)&lt;br&gt;Versioned + SSE-S3&lt;/font&gt;" style="shape=cylinder3;whiteSpace=wrap;html=1;fillColor=#FFCDD2;strokeColor=#C62828;size=12;fontSize=10;" vertex="1" parent="aws_region1">
      <mxGeometry x="240" y="45" width="160" height="120" as="geometry"/>
    </mxCell>

    <!-- SQS -->
    <mxCell id="sqs" value="&lt;b&gt;Amazon SQS&lt;/b&gt;&lt;br&gt;Processing Queue&lt;br&gt;&lt;font style=&quot;font-size:9px;&quot;&gt;Visibility: 16min&lt;br&gt;Retry: 3x → DLQ&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFF9C4;strokeColor=#F9A825;fontSize=10;" vertex="1" parent="aws_region1">
      <mxGeometry x="450" y="50" width="140" height="80" as="geometry"/>
    </mxCell>

    <!-- Lambda -->
    <mxCell id="lambda" value="&lt;b&gt;AWS Lambda&lt;/b&gt;&lt;br&gt;(Python 3.12)&lt;br&gt;&lt;hr&gt;&lt;font style=&quot;font-size:9px;&quot;&gt;1. PDF → WebP Images&lt;br&gt;2. Text Extraction (PyMuPDF)&lt;br&gt;3. Translation (Translate API)&lt;br&gt;4. DB Update + Webhook&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#E3F2FD;strokeColor=#1565C0;fontSize=10;" vertex="1" parent="aws_region1">
      <mxGeometry x="440" y="160" width="160" height="110" as="geometry"/>
    </mxCell>

    <!-- Amazon Translate -->
    <mxCell id="translate" value="&lt;b&gt;Amazon Translate&lt;/b&gt;&lt;br&gt;75 Languages&lt;br&gt;&lt;font style=&quot;font-size:9px;&quot;&gt;+ Comprehend (auto-detect)&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#F3E5F5;strokeColor=#7B1FA2;fontSize=10;" vertex="1" parent="aws_region1">
      <mxGeometry x="660" y="170" width="160" height="80" as="geometry"/>
    </mxCell>

    <!-- DLQ -->
    <mxCell id="dlq" value="&lt;b&gt;DLQ&lt;/b&gt;&lt;br&gt;&lt;font style=&quot;font-size:9px;&quot;&gt;14-day retention&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FFECB3;strokeColor=#FF8F00;fontSize=10;" vertex="1" parent="aws_region1">
      <mxGeometry x="640" y="55" width="100" height="50" as="geometry"/>
    </mxCell>

    <!-- AWS Region 2 -->
    <mxCell id="aws_region2" value="&lt;b&gt;AWS Region: us-east-1 (Virginia)&lt;/b&gt;" style="swimlane;startSize=25;fillColor=#F1F8E9;strokeColor=#33691E;rounded=1;arcSize=8;html=1;fontSize=11;" vertex="1" parent="1">
      <mxGeometry x="200" y="680" width="350" height="130" as="geometry"/>
    </mxCell>
    <mxCell id="dsql2" value="&lt;b&gt;Aurora DSQL&lt;/b&gt;&lt;br&gt;(Active-Active Replica)&lt;br&gt;&lt;font style=&quot;font-size:9px;&quot;&gt;Automatic replication&lt;br&gt;Strong consistency&lt;br&gt;&amp;lt;50ms reads for US users&lt;/font&gt;" style="shape=cylinder3;whiteSpace=wrap;html=1;fillColor=#C8E6C9;strokeColor=#2E7D32;size=12;fontSize=10;" vertex="1" parent="aws_region2">
      <mxGeometry x="90" y="35" width="180" height="85" as="geometry"/>
    </mxCell>

    <!-- Edges: User → Vercel -->
    <mxCell id="e1" edge="1" parent="1" source="user" target="vercel_group" style="edgeStyle=orthogonalEdgeStyle;rounded=1;strokeWidth=2;strokeColor=#1565C0;">
      <mxGeometry relative="1" as="geometry"/>
    </mxCell>

    <!-- Vercel → Clerk -->
    <mxCell id="e2" value="Auth" edge="1" parent="1" source="vercel_group" target="clerk" style="edgeStyle=orthogonalEdgeStyle;rounded=1;strokeColor=#7B1FA2;fontSize=9;">
      <mxGeometry relative="1" as="geometry"/>
    </mxCell>

    <!-- Vercel → Upstash -->
    <mxCell id="e3" value="Rate Check" edge="1" parent="1" source="vercel_group" target="upstash" style="edgeStyle=orthogonalEdgeStyle;rounded=1;strokeColor=#E65100;fontSize=9;">
      <mxGeometry relative="1" as="geometry"/>
    </mxCell>

    <!-- Vercel → DSQL -->
    <mxCell id="e4" value="Read/Write" edge="1" parent="1" source="vercel_group" target="dsql1" style="edgeStyle=orthogonalEdgeStyle;rounded=1;strokeColor=#2E7D32;fontSize=9;">
      <mxGeometry relative="1" as="geometry"/>
    </mxCell>

    <!-- Vercel → S3 -->
    <mxCell id="e5" value="Presigned URL" edge="1" parent="1" source="vercel_group" target="s3" style="edgeStyle=orthogonalEdgeStyle;rounded=1;strokeColor=#C62828;fontSize=9;">
      <mxGeometry relative="1" as="geometry"/>
    </mxCell>

    <!-- Vercel → SQS -->
    <mxCell id="e6" value="SendMessage" edge="1" parent="1" source="vercel_group" target="sqs" style="edgeStyle=orthogonalEdgeStyle;rounded=1;strokeColor=#F9A825;fontSize=9;">
      <mxGeometry relative="1" as="geometry"/>
    </mxCell>

    <!-- SQS → Lambda -->
    <mxCell id="e7" value="Event Source" edge="1" parent="1" source="sqs" target="lambda" style="edgeStyle=orthogonalEdgeStyle;rounded=1;strokeColor=#1565C0;strokeWidth=2;fontSize=9;">
      <mxGeometry relative="1" as="geometry"/>
    </mxCell>

    <!-- SQS → DLQ -->
    <mxCell id="e8" value="3x fail" edge="1" parent="1" source="sqs" target="dlq" style="edgeStyle=orthogonalEdgeStyle;rounded=1;strokeColor=#FF8F00;dashed=1;fontSize=9;">
      <mxGeometry relative="1" as="geometry"/>
    </mxCell>

    <!-- Lambda → Translate -->
    <mxCell id="e9" value="TranslateText" edge="1" parent="1" source="lambda" target="translate" style="edgeStyle=orthogonalEdgeStyle;rounded=1;strokeColor=#7B1FA2;fontSize=9;">
      <mxGeometry relative="1" as="geometry"/>
    </mxCell>

    <!-- Lambda → S3 (save images) -->
    <mxCell id="e10" value="Save WebP" edge="1" parent="1" source="lambda" target="s3" style="edgeStyle=orthogonalEdgeStyle;rounded=1;strokeColor=#C62828;dashed=1;fontSize=9;">
      <mxGeometry relative="1" as="geometry"/>
    </mxCell>

    <!-- Lambda → DSQL (status update) -->
    <mxCell id="e11" value="INSERT events" edge="1" parent="1" source="lambda" target="dsql1" style="edgeStyle=orthogonalEdgeStyle;rounded=1;strokeColor=#2E7D32;dashed=1;fontSize=9;">
      <mxGeometry relative="1" as="geometry"/>
    </mxCell>

    <!-- Lambda → Vercel Webhook -->
    <mxCell id="e12" value="revalidateTag" edge="1" parent="1" source="lambda" target="vercel_webhook" style="edgeStyle=orthogonalEdgeStyle;rounded=1;strokeColor=#D32F2F;dashed=1;strokeWidth=2;fontSize=9;">
      <mxGeometry relative="1" as="geometry"/>
    </mxCell>

    <!-- DSQL1 ↔ DSQL2 (replication) -->
    <mxCell id="e13" value="Multi-Region&lt;br&gt;Active-Active&lt;br&gt;Replication" edge="1" parent="1" source="dsql1" target="dsql2" style="edgeStyle=orthogonalEdgeStyle;rounded=1;strokeColor=#2E7D32;dashed=1;startArrow=classic;endArrow=classic;strokeWidth=2;fontSize=9;">
      <mxGeometry relative="1" as="geometry"/>
    </mxCell>

    <!-- Legend -->
    <mxCell id="legend" value="&lt;b&gt;Legend&lt;/b&gt;" style="swimlane;startSize=20;fillColor=#FAFAFA;strokeColor=#9E9E9E;rounded=1;fontSize=10;" vertex="1" parent="1">
      <mxGeometry x="1080" y="360" width="180" height="160" as="geometry"/>
    </mxCell>
    <mxCell id="leg1" value="── Synchronous call" style="text;html=1;fontSize=9;align=left;" vertex="1" parent="legend">
      <mxGeometry x="10" y="30" width="160" height="20" as="geometry"/>
    </mxCell>
    <mxCell id="leg2" value="- - Async / Background" style="text;html=1;fontSize=9;align=left;" vertex="1" parent="legend">
      <mxGeometry x="10" y="55" width="160" height="20" as="geometry"/>
    </mxCell>
    <mxCell id="leg3" value="━ Critical data path" style="text;html=1;fontSize=9;align=left;" vertex="1" parent="legend">
      <mxGeometry x="10" y="80" width="160" height="20" as="geometry"/>
    </mxCell>
    <mxCell id="leg4" value="🟢 Database (DSQL)" style="text;html=1;fontSize=9;align=left;" vertex="1" parent="legend">
      <mxGeometry x="10" y="105" width="160" height="20" as="geometry"/>
    </mxCell>
    <mxCell id="leg5" value="🔴 Storage (S3)" style="text;html=1;fontSize=9;align=left;" vertex="1" parent="legend">
      <mxGeometry x="10" y="130" width="160" height="20" as="geometry"/>
    </mxCell>

    <!-- Data Flow Numbers -->
    <mxCell id="flow_note" value="&lt;b&gt;Data Flow&lt;/b&gt;&lt;br&gt;&lt;font style=&quot;font-size:9px;&quot;&gt;1. Upload: User → Vercel → S3&lt;br&gt;2. Queue: Vercel → SQS&lt;br&gt;3. Process: SQS → Lambda&lt;br&gt;4. Translate: Lambda → Translate&lt;br&gt;5. Store: Lambda → S3 + DSQL&lt;br&gt;6. Invalidate: Lambda → Webhook&lt;br&gt;7. Serve: User → CDN → DSQL&lt;/font&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#FAFAFA;strokeColor=#9E9E9E;fontSize=10;align=left;spacingLeft=8;" vertex="1" parent="1">
      <mxGeometry x="1080" y="540" width="200" height="140" as="geometry"/>
    </mxCell>

  </root>
</mxGraphModel>
```

---

## Component Summary

| Component | Service | Role |
|---|---|---|
| Global Users | Browser/Mobile | End users accessing the platform |
| Vercel Platform | Edge CDN + Next.js + WAF | Frontend hosting, SSR/ISR, security |
| Clerk | Authentication | OAuth, session management, webhook sync |
| Upstash Redis | Rate Limiting | IP/user rate limits, HyperLogLog analytics |
| Aurora DSQL (Tokyo) | Primary Database | All application data, event sourcing |
| Aurora DSQL (Virginia) | Active-Active Replica | Low-latency reads for US/EU users |
| Amazon S3 | Object Storage | PDF files + WebP slide images |
| Amazon SQS | Message Queue | Decoupled async processing pipeline |
| AWS Lambda | Compute | PDF→Image, text extraction, translation |
| Amazon Translate | ML Service | 75-language machine translation |
| DLQ | Dead Letter Queue | Failed job retention for debugging |

## Key Architecture Decisions

1. **Decoupled processing**: Upload returns immediately; heavy PDF processing happens asynchronously via SQS→Lambda
2. **Multi-Region Active-Active**: Aurora DSQL replicates automatically between Tokyo and Virginia for global low-latency
3. **Event-driven cache invalidation**: Lambda calls Vercel's revalidateTag webhook — no polling, instant updates
4. **Presigned URLs for upload**: Client uploads directly to S3, bypassing Vercel's request size limits
5. **DLQ for reliability**: Failed processing jobs are preserved (14 days) rather than lost
6. **INSERT-only writes**: Event sourcing pattern avoids OCC conflicts in DSQL's optimistic concurrency model
