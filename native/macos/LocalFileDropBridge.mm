#import <Cocoa/Cocoa.h>
#import <objc/runtime.h>

#include <mutex>

using FileDropCallback = void (*)(const char *pathsJson);
using PerformDragOperation = BOOL (*)(id, SEL, id<NSDraggingInfo>);

static FileDropCallback gFileDropCallback = nullptr;
static std::mutex gBridgeMutex;
static Class gHookedClass = Nil;
static IMP gOriginalPerformDragOperation = nullptr;

static NSArray<NSString *> *subtitleDuckReadDroppedFilePaths(id<NSDraggingInfo> sender) {
  NSPasteboard *pasteboard = sender.draggingPasteboard;
  NSDictionary *options = @{
    NSPasteboardURLReadingFileURLsOnlyKey: @YES,
  };
  NSArray<NSURL *> *urls = [pasteboard readObjectsForClasses:@[[NSURL class]]
                                                     options:options];
  NSMutableArray<NSString *> *paths = [NSMutableArray array];
  NSMutableSet<NSString *> *seenPaths = [NSMutableSet set];

  for (NSURL *url in urls) {
    if (!url.isFileURL) continue;
    NSString *originalPath = url.path;
    NSString *pathKey = originalPath.stringByStandardizingPath;
    if (originalPath.length == 0 || [seenPaths containsObject:pathKey]) continue;
    [seenPaths addObject:pathKey];
    [paths addObject:originalPath];
  }

  return paths;
}

static void subtitleDuckEmitDroppedFilePaths(id<NSDraggingInfo> sender) {
  FileDropCallback callback = nullptr;
  {
    std::lock_guard<std::mutex> lock(gBridgeMutex);
    callback = gFileDropCallback;
  }
  if (!callback) return;

  NSArray<NSString *> *paths = subtitleDuckReadDroppedFilePaths(sender);
  if (paths.count == 0) return;

  NSError *error = nil;
  NSData *jsonData = [NSJSONSerialization dataWithJSONObject:paths
                                                     options:0
                                                       error:&error];
  if (!jsonData || error) return;

  NSString *json = [[NSString alloc] initWithData:jsonData
                                         encoding:NSUTF8StringEncoding];
  if (json.length == 0) return;

  char *jsonCopy = strdup(json.UTF8String);
  callback(jsonCopy);
  dispatch_after(
      dispatch_time(DISPATCH_TIME_NOW, (int64_t)(1 * NSEC_PER_SEC)),
      dispatch_get_main_queue(), ^{
        free(jsonCopy);
      });
}

static BOOL subtitleDuckPerformDragOperation(id self, SEL selector,
                                     id<NSDraggingInfo> sender) {
  subtitleDuckEmitDroppedFilePaths(sender);

  IMP original = nullptr;
  {
    std::lock_guard<std::mutex> lock(gBridgeMutex);
    original = gOriginalPerformDragOperation;
  }

  if (!original) return NO;
  return reinterpret_cast<PerformDragOperation>(original)(self, selector, sender);
}

static bool subtitleDuckClassOwnsSelector(Class candidate, SEL selector,
                                  Method *ownedMethod) {
  unsigned int methodCount = 0;
  Method *methods = class_copyMethodList(candidate, &methodCount);
  bool ownsSelector = false;
  for (unsigned int index = 0; index < methodCount; index += 1) {
    if (method_getName(methods[index]) == selector) {
      *ownedMethod = methods[index];
      ownsSelector = true;
      break;
    }
  }
  free(methods);
  return ownsSelector;
}

static void subtitleDuckFindActiveDropHandlerClass(NSView *view, SEL selector,
                                           int viewDepth, Class *bestClass,
                                           int *bestDepth) {
  Class candidate = object_getClass(view);
  const char *className = class_getName(candidate);
  if (className && view.registeredDraggedTypes.count > 0 &&
      [view respondsToSelector:selector]) {
    if (viewDepth > *bestDepth) {
      *bestClass = candidate;
      *bestDepth = viewDepth;
    }
  }

  for (NSView *subview in view.subviews) {
    subtitleDuckFindActiveDropHandlerClass(subview, selector, viewDepth + 1,
                                   bestClass, bestDepth);
  }
}

static int subtitleDuckInstallDropHooks(void) {
  SEL selector = @selector(performDragOperation:);
  {
    std::lock_guard<std::mutex> lock(gBridgeMutex);
    if (gHookedClass) return 1;
  }

  Class activeHandlerClass = Nil;
  int activeHandlerDepth = -1;
  for (NSWindow *window in NSApp.windows) {
    if (!window.contentView) continue;
    subtitleDuckFindActiveDropHandlerClass(window.contentView, selector, 0,
                                   &activeHandlerClass, &activeHandlerDepth);
  }
  if (activeHandlerClass) {
    Method resolvedMethod = class_getInstanceMethod(activeHandlerClass, selector);
    Method ownedMethod = nullptr;
    if (resolvedMethod) {
      std::lock_guard<std::mutex> lock(gBridgeMutex);
      if (gHookedClass) return 0;
      gOriginalPerformDragOperation = method_getImplementation(resolvedMethod);
      if (subtitleDuckClassOwnsSelector(activeHandlerClass, selector, &ownedMethod)) {
        method_setImplementation(
            ownedMethod, reinterpret_cast<IMP>(subtitleDuckPerformDragOperation));
      } else {
        class_addMethod(activeHandlerClass, selector,
                        reinterpret_cast<IMP>(subtitleDuckPerformDragOperation),
                        method_getTypeEncoding(resolvedMethod));
      }
      gHookedClass = activeHandlerClass;
      return 1;
    }
  }
  return 0;
}

extern "C" __attribute__((visibility("default"))) int
subtitle_duck_install_file_drop_bridge(FileDropCallback callback) {
  {
    std::lock_guard<std::mutex> lock(gBridgeMutex);
    gFileDropCallback = callback;
  }
  return 0;
}

extern "C" __attribute__((visibility("default"))) int
subtitle_duck_refresh_file_drop_bridge(void) {
  return subtitleDuckInstallDropHooks();
}
