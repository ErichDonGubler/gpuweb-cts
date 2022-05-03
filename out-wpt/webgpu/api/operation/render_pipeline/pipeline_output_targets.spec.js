/**
 * AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
 **/ export const description = `
- Test pipeline outputs with different color attachment number, formats, component counts, etc.
`;
import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { range, unreachable } from '../../../../common/util/util.js';
import { kRenderableColorTextureFormats, kTextureFormatInfo } from '../../../capability_info.js';
import { GPUTest } from '../../../gpu_test.js';
import { kTexelRepresentationInfo } from '../../../util/texture/texel_data.js';

const kVertexShader = `
@stage(vertex) fn main(
@builtin(vertex_index) VertexIndex : u32
) -> @builtin(position) vec4<f32> {
  var pos : array<vec2<f32>, 3> = array<vec2<f32>, 3>(
      vec2<f32>(-1.0, -3.0),
      vec2<f32>(3.0, 1.0),
      vec2<f32>(-1.0, 1.0));
  return vec4<f32>(pos[VertexIndex], 0.0, 1.0);
}
`;

class F extends GPUTest {
  // Build fragment shader based on output value and types
  // e.g. write to color target 0 a vec4<f32>(1.0, 0.0, 1.0, 1.0) and color target 2 a vec2<u32>(1, 2)
  // outputs: [
  //   {
  //     values: [1, 0, 1, 1],,
  //     sampleType: 'float',
  //     componentCount: 4,
  //   },
  //   null,
  //   {
  //     values: [1, 2],
  //     sampleType: 'uint',
  //     componentCount: 2,
  //   },
  // ]
  //
  // return:
  // struct Outputs {
  //     @location(0) o1 : vec4<f32>;
  //     @location(2) o3 : vec2<u32>;
  // }
  // @stage(fragment) fn main() -> Outputs {
  //     return Outputs(vec4<f32>(1.0, 0.0, 1.0, 1.0), vec4<u32>(1, 2));
  // }
  getFragmentShaderCode(outputs) {
    const resultStrings = [];
    let outputStructString = '';

    for (let i = 0; i < outputs.length; i++) {
      const o = outputs[i];
      if (o === null) {
        continue;
      }

      let fragColorType;
      let suffix;
      let fractionDigits = 0;
      switch (o.sampleType) {
        case 'sint':
          fragColorType = 'i32';
          suffix = '';
          break;
        case 'uint':
          fragColorType = 'u32';
          suffix = 'u';
          break;
        case 'float':
        case 'unfilterable-float':
          fragColorType = 'f32';
          suffix = '';
          fractionDigits = 4;
          break;
        default:
          unreachable();
      }

      let outputType;
      const v = o.values.map(n => n.toFixed(fractionDigits));
      switch (o.componentCount) {
        case 1:
          outputType = fragColorType;
          resultStrings.push(`${v[0]}${suffix}`);
          break;
        case 2:
          outputType = `vec2<${fragColorType}>`;
          resultStrings.push(`${outputType}(${v[0]}${suffix}, ${v[1]}${suffix})`);
          break;
        case 3:
          outputType = `vec3<${fragColorType}>`;
          resultStrings.push(`${outputType}(${v[0]}${suffix}, ${v[1]}${suffix}, ${v[2]}${suffix})`);
          break;
        case 4:
          outputType = `vec4<${fragColorType}>`;
          resultStrings.push(
            `${outputType}(${v[0]}${suffix}, ${v[1]}${suffix}, ${v[2]}${suffix}, ${v[3]}${suffix})`
          );

          break;
        default:
          unreachable();
      }

      outputStructString += `@location(${i}) o${i} : ${outputType},\n`;
    }

    return `
    struct Outputs {
      ${outputStructString}
    }

    @stage(fragment) fn main() -> Outputs {
        return Outputs(${resultStrings.join(',')});
    }`;
  }
}

export const g = makeTestGroup(F);

g.test('color,attachments')
  .desc(`Test that pipeline with  sparse color attachments write values correctly.`)
  .params(u =>
    u
      .combine('format', kRenderableColorTextureFormats)
      .beginSubcases()
      .combine('attachmentCount', [2, 3, 4])
      .expand('emptyAttachmentId', p => range(p.attachmentCount, i => i))
  )
  .beforeAllSubcases(async t => {
    const info = kTextureFormatInfo[t.params.format];
    await t.selectDeviceOrSkipTestCase(info.feature);
  })
  .fn(async t => {
    const { format, attachmentCount, emptyAttachmentId } = t.params;
    const componentCount = kTexelRepresentationInfo[format].componentOrder.length;
    const info = kTextureFormatInfo[format];

    const writeValue =
      info.sampleType === 'float' ? { R: 0.2, G: 0.6, B: 0.8, A: 1 } : { R: 2, G: 4, B: 8, A: 16 };

    const renderTargets = range(attachmentCount, () =>
      t.device.createTexture({
        format,
        size: { width: 1, height: 1, depthOrArrayLayers: 1 },
        usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT,
      })
    );

    const pipeline = t.device.createRenderPipeline({
      vertex: {
        module: t.device.createShaderModule({
          code: kVertexShader,
        }),

        entryPoint: 'main',
      },

      fragment: {
        module: t.device.createShaderModule({
          code: t.getFragmentShaderCode(
            range(attachmentCount, i =>
              i === emptyAttachmentId
                ? null
                : {
                    values: [writeValue.R, writeValue.G, writeValue.B, writeValue.A],
                    sampleType: info.sampleType,
                    componentCount,
                  }
            )
          ),
        }),

        entryPoint: 'main',
        targets: range(attachmentCount, i => (i === emptyAttachmentId ? null : { format })),
      },

      primitive: { topology: 'triangle-list' },
    });

    const encoder = t.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: range(attachmentCount, i =>
        i === emptyAttachmentId
          ? null
          : {
              view: renderTargets[i].createView(),
              storeOp: 'store',
              clearValue: { r: 0.5, g: 0.5, b: 0.5, a: 0.5 },
              loadOp: 'clear',
            }
      ),
    });

    pass.setPipeline(pipeline);
    pass.draw(3);
    pass.end();
    t.device.queue.submit([encoder.finish()]);

    for (let i = 0; i < attachmentCount; i++) {
      if (i === emptyAttachmentId) {
        continue;
      }
      t.expectSingleColor(renderTargets[i], format, {
        size: [1, 1, 1],
        exp: writeValue,
      });
    }
  });

g.test('color,component_count')
  .desc(
    `Test that extra components of the output (e.g. f32, vec2<f32>, vec3<f32>, vec4<f32>) are discarded.`
  )
  .params(u =>
    u
      .combine('format', kRenderableColorTextureFormats)
      .beginSubcases()
      .combine('componentCount', [1, 2, 3, 4])
      .filter(x => x.componentCount >= kTexelRepresentationInfo[x.format].componentOrder.length)
  )
  .beforeAllSubcases(async t => {
    const info = kTextureFormatInfo[t.params.format];
    await t.selectDeviceOrSkipTestCase(info.feature);
  })
  .fn(async t => {
    const { format, componentCount } = t.params;
    const info = kTextureFormatInfo[format];

    // expected RGBA values
    // extra channels are discarded
    const values = [0, 1, 0, 1];

    const renderTarget = t.device.createTexture({
      format,
      size: { width: 1, height: 1, depthOrArrayLayers: 1 },
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT,
    });

    const pipeline = t.device.createRenderPipeline({
      vertex: {
        module: t.device.createShaderModule({
          code: kVertexShader,
        }),

        entryPoint: 'main',
      },

      fragment: {
        module: t.device.createShaderModule({
          code: t.getFragmentShaderCode([
            {
              values,
              sampleType: info.sampleType,
              componentCount,
            },
          ]),
        }),

        entryPoint: 'main',
        targets: [{ format }],
      },

      primitive: { topology: 'triangle-list' },
    });

    const encoder = t.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: renderTarget.createView(),
          storeOp: 'store',
          clearValue: { r: 1.0, g: 0.0, b: 0.0, a: 1.0 },
          loadOp: 'clear',
        },
      ],
    });

    pass.setPipeline(pipeline);
    pass.draw(3);
    pass.end();
    t.device.queue.submit([encoder.finish()]);

    t.expectSingleColor(renderTarget, format, {
      size: [1, 1, 1],
      exp: { R: values[0], G: values[1], B: values[2], A: values[3] },
    });
  });

g.test('color,component_count,blend')
  .desc(
    `Test that blending behaves correctly when:
- fragment output has no alpha, but the src alpha is not used for the blend operation indicated by blend factors
- attachment format has no alpha, and the dst alpha should be assumed as 1

The attachment has a load value of [1, 0, 0, 1]
`
  )
  .params(u =>
    u
      .combine('format', ['r8unorm', 'rg8unorm', 'rgba8unorm', 'bgra8unorm'])
      .beginSubcases()
      // _result is expected values in the color attachment (extra channels are discarded)
      // output is the fragment shader output vector
      // 0.498 -> 0x7f, 0.502 -> 0x80
      .combineWithParams([
        // fragment output has no alpha
        {
          _result: [0, 0, 0, 0],
          output: [0],
          colorSrcFactor: 'one',
          colorDstFactor: 'zero',
          alphaSrcFactor: 'zero',
          alphaDstFactor: 'zero',
        },

        {
          _result: [0, 0, 0, 0],
          output: [0],
          colorSrcFactor: 'dst-alpha',
          colorDstFactor: 'zero',
          alphaSrcFactor: 'zero',
          alphaDstFactor: 'zero',
        },

        {
          _result: [1, 0, 0, 0],
          output: [0],
          colorSrcFactor: 'one-minus-dst-alpha',
          colorDstFactor: 'dst-alpha',
          alphaSrcFactor: 'zero',
          alphaDstFactor: 'one',
        },

        {
          _result: [0.498, 0, 0, 0],
          output: [0.498],
          colorSrcFactor: 'dst-alpha',
          colorDstFactor: 'zero',
          alphaSrcFactor: 'zero',
          alphaDstFactor: 'one',
        },

        {
          _result: [0, 1, 0, 0],
          output: [0, 1],
          colorSrcFactor: 'one',
          colorDstFactor: 'zero',
          alphaSrcFactor: 'zero',
          alphaDstFactor: 'zero',
        },

        {
          _result: [0, 1, 0, 0],
          output: [0, 1],
          colorSrcFactor: 'dst-alpha',
          colorDstFactor: 'zero',
          alphaSrcFactor: 'zero',
          alphaDstFactor: 'zero',
        },

        {
          _result: [1, 0, 0, 0],
          output: [0, 1],
          colorSrcFactor: 'one-minus-dst-alpha',
          colorDstFactor: 'dst-alpha',
          alphaSrcFactor: 'zero',
          alphaDstFactor: 'one',
        },

        {
          _result: [0, 1, 0, 0],
          output: [0, 1, 0],
          colorSrcFactor: 'one',
          colorDstFactor: 'zero',
          alphaSrcFactor: 'zero',
          alphaDstFactor: 'zero',
        },

        {
          _result: [0, 1, 0, 0],
          output: [0, 1, 0],
          colorSrcFactor: 'dst-alpha',
          colorDstFactor: 'zero',
          alphaSrcFactor: 'zero',
          alphaDstFactor: 'zero',
        },

        {
          _result: [1, 0, 0, 0],
          output: [0, 1, 0],
          colorSrcFactor: 'one-minus-dst-alpha',
          colorDstFactor: 'dst-alpha',
          alphaSrcFactor: 'zero',
          alphaDstFactor: 'one',
        },

        // fragment output has alpha
        {
          _result: [0.502, 1, 0, 0.498],
          output: [0, 1, 0, 0.498],
          colorSrcFactor: 'one',
          colorDstFactor: 'one-minus-src-alpha',
          alphaSrcFactor: 'one',
          alphaDstFactor: 'zero',
        },

        {
          _result: [0.502, 0.498, 0, 0.498],
          output: [0, 1, 0, 0.498],
          colorSrcFactor: 'src-alpha',
          colorDstFactor: 'one-minus-src-alpha',
          alphaSrcFactor: 'one',
          alphaDstFactor: 'zero',
        },

        {
          _result: [0, 1, 0, 0.498],
          output: [0, 1, 0, 0.498],
          colorSrcFactor: 'dst-alpha',
          colorDstFactor: 'zero',
          alphaSrcFactor: 'one',
          alphaDstFactor: 'zero',
        },

        {
          _result: [0, 1, 0, 0.498],
          output: [0, 1, 0, 0.498],
          colorSrcFactor: 'dst-alpha',
          colorDstFactor: 'zero',
          alphaSrcFactor: 'zero',
          alphaDstFactor: 'src',
        },

        {
          _result: [1, 0, 0, 1],
          output: [0, 1, 0, 0.498],
          colorSrcFactor: 'one-minus-dst-alpha',
          colorDstFactor: 'dst-alpha',
          alphaSrcFactor: 'zero',
          alphaDstFactor: 'dst-alpha',
        },
      ])
      .filter(x => x.output.length >= kTexelRepresentationInfo[x.format].componentOrder.length)
  )
  .beforeAllSubcases(async t => {
    const info = kTextureFormatInfo[t.params.format];
    await t.selectDeviceOrSkipTestCase(info.feature);
  })
  .fn(async t => {
    const {
      format,
      _result,
      output,
      colorSrcFactor,
      colorDstFactor,
      alphaSrcFactor,
      alphaDstFactor,
    } = t.params;
    const componentCount = output.length;
    const info = kTextureFormatInfo[format];

    const renderTarget = t.device.createTexture({
      format,
      size: { width: 1, height: 1, depthOrArrayLayers: 1 },
      usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT,
    });

    const pipeline = t.device.createRenderPipeline({
      vertex: {
        module: t.device.createShaderModule({
          code: kVertexShader,
        }),

        entryPoint: 'main',
      },

      fragment: {
        module: t.device.createShaderModule({
          code: t.getFragmentShaderCode([
            {
              values: output,
              sampleType: info.sampleType,
              componentCount,
            },
          ]),
        }),

        entryPoint: 'main',
        targets: [
          {
            format,
            blend: {
              color: {
                srcFactor: colorSrcFactor,
                dstFactor: colorDstFactor,
                operation: 'add',
              },

              alpha: {
                srcFactor: alphaSrcFactor,
                dstFactor: alphaDstFactor,
                operation: 'add',
              },
            },
          },
        ],
      },

      primitive: { topology: 'triangle-list' },
    });

    const encoder = t.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: renderTarget.createView(),
          storeOp: 'store',
          clearValue: { r: 1.0, g: 0.0, b: 0.0, a: 1.0 },
          loadOp: 'clear',
        },
      ],
    });

    pass.setPipeline(pipeline);
    pass.draw(3);
    pass.end();
    t.device.queue.submit([encoder.finish()]);

    t.expectSingleColor(renderTarget, format, {
      size: [1, 1, 1],
      exp: { R: _result[0], G: _result[1], B: _result[2], A: _result[3] },
    });
  });