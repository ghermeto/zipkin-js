/* eslint-disable new-cap,no-shadow */
const Instrumentation = require('./grpcClientInstrumentation');

/**
 * @typedef {Object} InterceptorContext
 * @property {zipkin.Tracer} tracer
 * @property {string} serviceName
 * @property {string} remoteServiceName
 */

/**
 * @method
 * @param {Object} grpc
 * @param {InterceptorContext} context
 * @returns {Interceptor}
 */
const interceptor = (grpc, {tracer, serviceName, remoteServiceName}) => {
  const instrumentation = new Instrumentation(grpc, {tracer, serviceName, remoteServiceName});

  /**
   * @typedef {Function} Interceptor
   * @param {Object} options
   * @param {function()} nextCall
   */
  return (options, nextCall) => {
    const method = options.method_definition.path;

    return tracer.scoped(() =>
      new grpc.InterceptingCall(nextCall(options), {
        /**
         * @param {grpc.Metadata} metadata
         * @param {Object} listener
         * @param {function(metadata: grpc.Metadata, listener: Object)} next
         */
        start(metadata, listener, next) {
          const zipkinMetadata = instrumentation.start(metadata, method);
          const traceId = tracer.id;

          next(zipkinMetadata, {
            /**
             * @param {grpc.Status} status
             * @param {function(status: grpc.Status)} next
             */
            onReceiveStatus(status, next) {
              instrumentation.onReceiveStatus(traceId, status);
              next(status);
            }
          });
        }
      })
    );
  };
};

module.exports = interceptor;
